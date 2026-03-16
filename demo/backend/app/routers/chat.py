"""Chat endpoints — Python pipeline with parallel phases + Agent Builder enrichment."""

import json
import time
import asyncio
import logging

from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from app.models.schemas import ChatRequest, ChatResponse
from app.models.agent_models import AgentChatRequest

router = APIRouter()

logger = logging.getLogger(__name__)


@router.post("")
async def chat(req: ChatRequest) -> ChatResponse:
    """Simple RAG chat."""
    from app.services.rag import rag_query
    t0 = time.time()
    try:
        result = await rag_query(req.message, req.history)
        total_ms = round((time.time() - t0) * 1000)
        return ChatResponse(
            response=result["response"],
            sources=result["sources"],
            latency={"total": total_ms},
        )
    except Exception as e:
        return ChatResponse(
            response=f"Error: {e}",
            sources=[],
            latency={"total": round((time.time() - t0) * 1000)},
        )


@router.post("/agent/stream")
async def agent_stream(req: AgentChatRequest):
    """SSE streaming — all 5 phases, phases 2-4 run in parallel."""

    async def generate():
        job_id = f"agent-{int(time.time())}"
        yield f"event: job_start\ndata: {json.dumps({'job_id': job_id})}\n\n"

        from app.services.phases.phase0_sensors import run_phase0
        from app.services.phases.phase1_historical import run_phase1
        from app.services.phases.phase2_risk import run_phase2
        from app.services.phases.phase3_recommendation import run_phase3
        from app.services.phases.phase4_action_plan import run_phase4

        # ── Phase 0: Sensor Snapshot (fast, ES only) ──
        yield _sse("phase_start", {"phase_id": "sensors", "progress_pct": 5})
        yield _sse("phase_progress", {"phase_id": "sensors", "message": "Querying soil + NPK indices..."})

        sensor = await run_phase0(block_id=req.block_id)

        sensor_data = {
            "block_id": sensor.block_id,
            "moisture": sensor.moisture,
            "temperature": sensor.temperature,
            "nitrogen": sensor.nitrogen,
            "phosphorus": sensor.phosphorus,
            "potassium": sensor.potassium,
            "ph": sensor.ph,
            "health": sensor.health_status,
        }
        yield _sse("phase_progress", {"phase_id": "sensors", "message": f"Block {sensor.block_id}: moisture {sensor.moisture}%, K:{sensor.potassium} mg/kg"})
        yield _sse("phase_complete", {"phase_id": "sensors", "data": sensor_data, "progress_pct": 20})

        # ── Phase 1: Historical Context (kNN + LLM) ──
        yield _sse("phase_start", {"phase_id": "historical", "progress_pct": 20})
        yield _sse("phase_progress", {"phase_id": "historical", "message": "kNN vector search against 841K soil records..."})

        historical = await run_phase1(sensor)

        hist_data = {
            "pattern_summary": historical.pattern_summary[:500] if historical.pattern_summary else "No patterns found",
            "matches": [{"title": m.title, "similarity": m.similarity} for m in (historical.matches or [])[:5]],
            "years_of_data": historical.years_of_data,
        }
        yield _sse("phase_progress", {"phase_id": "historical", "message": f"Found {len(historical.matches or [])} similar conditions across {historical.years_of_data} years"})
        yield _sse("phase_complete", {"phase_id": "historical", "data": hist_data, "progress_pct": 40})

        # ── Phases 2-4: Run in PARALLEL ──
        yield _sse("phase_start", {"phase_id": "risk", "progress_pct": 40})
        yield _sse("phase_start", {"phase_id": "recommendation", "progress_pct": 40})
        yield _sse("phase_start", {"phase_id": "action_plan", "progress_pct": 40})
        yield _sse("phase_progress", {"phase_id": "risk", "message": "Running risk, recommendation, and action plan in parallel via GPT-OSS 120B..."})

        try:
            # Get variety from sensor block
            variety = "Cabernet Sauvignon"  # default
            block_varieties = {
                "BLK-A": "Cabernet Sauvignon", "BLK-B": "Syrah", "BLK-C": "Merlot",
                "BLK-D": "Chardonnay", "BLK-E": "Cabernet Franc", "BLK-F": "Riesling",
            }
            if sensor.block_id in block_varieties:
                variety = block_varieties[sensor.block_id]

            # Phase 2: Risk — run with heartbeats
            risk_task = asyncio.create_task(run_phase2(sensor, historical, req.message))

            hb_risk = [
                "Evaluating disease pressure from 17K imagery records...",
                "Analyzing moisture stress against historical thresholds...",
                "Checking nutrient deficiency indicators...",
            ]
            hb_idx = 0
            while not risk_task.done():
                await asyncio.sleep(3)
                if hb_idx < len(hb_risk):
                    yield _sse("phase_progress", {"phase_id": "risk", "message": hb_risk[hb_idx]})
                    hb_idx += 1

            risk = await risk_task

            risk_data = {
                "overall_risk": getattr(risk, 'overall_risk', 'medium'),
                "risks": [
                    {"severity": r.severity, "description": r.description, "category": getattr(r, 'category', 'general')}
                    for r in getattr(risk, 'risks', [])
                ][:5],
                "summary": getattr(risk, 'summary', str(risk)),
            }
            yield _sse("phase_complete", {"phase_id": "risk", "data": risk_data, "progress_pct": 60})

            # Phase 3: Recommendation — run with heartbeats
            yield _sse("phase_progress", {"phase_id": "recommendation", "message": f"Generating {variety}-specific management recommendations..."})

            rec_task = asyncio.create_task(run_phase3(sensor, risk, req.message, variety=variety))

            hb_rec = [
                "Consulting harvest quality trends for this block...",
                "Prioritizing actions by urgency...",
            ]
            hb_idx = 0
            while not rec_task.done():
                await asyncio.sleep(3)
                if hb_idx < len(hb_rec):
                    yield _sse("phase_progress", {"phase_id": "recommendation", "message": hb_rec[hb_idx]})
                    hb_idx += 1

            rec = await rec_task

            rec_data = {
                "recommendations": [
                    {"action": r.action, "priority": r.priority, "rationale": r.rationale}
                    for r in getattr(rec, 'recommendations', [])
                ][:5],
                "variety_notes": getattr(rec, 'variety_notes', ''),
                "summary": getattr(rec, 'summary', str(rec)),
            }
            yield _sse("phase_complete", {"phase_id": "recommendation", "data": rec_data, "progress_pct": 80})

            # Phase 4: Action Plan
            yield _sse("phase_progress", {"phase_id": "action_plan", "message": "Building concrete task assignments and timeline..."})

            action_task = asyncio.create_task(run_phase4(rec))

            while not action_task.done():
                await asyncio.sleep(3)
                yield _sse("phase_progress", {"phase_id": "action_plan", "message": "Finalizing action plan..."})

            action = await action_task

            action_data = {
                "actions": [
                    {"task": a.task, "assignee": a.assignee, "deadline": a.deadline, "equipment": getattr(a, 'equipment', '')}
                    for a in getattr(action, 'actions', [])
                ][:6],
                "estimated_cost": getattr(action, 'estimated_cost', ''),
                "summary": getattr(action, 'summary', str(action)),
            }
            yield _sse("phase_complete", {"phase_id": "action_plan", "data": action_data, "progress_pct": 100})

            yield _sse("job_complete", {
                "results": {
                    "action_plan": {"summary": action_data.get("summary", "Analysis complete.")},
                    "model": "gpt-oss:120b",
                    "phases_completed": 5,
                }
            })

        except Exception as e:
            logger.exception("Pipeline error")
            yield _sse("phase_error", {"phase_id": "risk", "message": str(e)})
            yield _sse("job_complete", {
                "results": {
                    "action_plan": {"summary": f"Partial analysis — sensor data: {sensor.summary}. Error in LLM phases: {str(e)}"},
                }
            })

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive", "X-Accel-Buffering": "no"},
    )


def _sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"
