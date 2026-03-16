"""Prompt templates for vineyard advisor phases."""

SYSTEM_AGRONOMIST = """You are the AI agronomist for Domaine de la Côte Cachée, a 22-acre \
premium wine estate in the Walla Walla AVA, Washington. The estate has 6 blocks:
- BLK-A "Les Pierres": Cabernet Sauvignon, south-facing, loess over basalt, star performer
- BLK-B "Clos du Vent": Syrah, southwest ridge, shallow rocky, wind-exposed, drought-vulnerable
- BLK-C "La Rivière": Merlot, east-facing lowland, alluvial clay — CRITICAL: drainage failure since mid-2022, potassium crashing from 210→50 mg/kg, persistent waterlogging
- BLK-D "Le Jardin": Chardonnay, northeast, sandy loam, prone to powdery mildew in wet years
- BLK-E "Vieilles Vignes": Cabernet Franc, 35-year-old vines, volcanic soil, remarkably consistent
- BLK-F "Le Plateau": Riesling, highest elevation (320m), limestone, cool-climate

You have access to 8 years of sensor data (2018-2025), 841K soil readings, 10K NPK profiles, \
17K disease imagery embeddings, and harvest/wine quality records in Elasticsearch.

Key events: 2020 drought (BLK-B hit hardest, but produced best Syrah — concentration effect), \
2022 wet spring (disease outbreak in BLK-C and BLK-D), BLK-C drainage tile failure starting June 2022.

Be specific, cite data points, and always respond in valid JSON matching the requested schema."""


PHASE1_HISTORICAL = """Analyze these historical soil/weather records that are similar to the \
current vineyard conditions.

## Current Conditions
{sensor_context}

## Similar Historical Records (from kNN vector search)
{historical_hits}

## Task
Identify patterns in the historical data that are relevant to the current conditions. \
Look for outcomes (good harvests, disease outbreaks, crop loss) that followed similar conditions.

Respond in JSON:
{{
  "matches": [
    {{
      "title": "descriptive name for this historical match",
      "similarity": 0.0-1.0,
      "year": 2020,
      "outcome": "what happened",
      "conditions": "brief condition summary"
    }}
  ],
  "pattern_summary": "overall pattern analysis",
  "years_of_data": 10
}}"""


PHASE2_RISK = """Based on the sensor snapshot and historical patterns, assess the risks \
facing this vineyard block.

## Current Sensor Data
{sensor_context}

## Historical Pattern Analysis
{historical_summary}

## User Question
{user_question}

## Task
Identify and rank all risks. Consider: disease pressure, moisture stress, nutrient \
deficiency/toxicity, temperature extremes, pH imbalance.

Respond in JSON:
{{
  "risks": [
    {{
      "category": "disease|moisture|nutrient|temperature|pH",
      "severity": "low|medium|high|critical",
      "description": "specific risk description",
      "confidence": 0.0-1.0
    }}
  ],
  "overall_risk": "low|medium|high|critical",
  "summary": "1-2 sentence risk summary"
}}"""


PHASE3_RECOMMENDATION = """Based on the risk analysis and current conditions, provide \
specific crop management recommendations for this vineyard block.

## Current Conditions
{sensor_context}

## Risk Analysis
{risk_summary}

## Grape Variety
{variety}

## User Question
{user_question}

## Task
Provide actionable recommendations ordered by priority. Consider irrigation, fertilization, \
pest/disease management, canopy management, and harvest timing.

Respond in JSON:
{{
  "recommendations": [
    {{
      "action": "specific action to take",
      "priority": "low|medium|high|urgent",
      "rationale": "why this matters",
      "timing": "when to do it"
    }}
  ],
  "variety_notes": "variety-specific considerations",
  "summary": "1-2 sentence recommendation summary"
}}"""


PHASE4_ACTION_PLAN = """Create a concrete action plan from these recommendations.

## Recommendations
{recommendations}

## Available Resources
Field crew (3 people), standard vineyard equipment, limited chemical inventory (copper fungicide, \
sulfur, standard NPK fertilizers), drip irrigation system.

## Task
Convert recommendations into a day-by-day action plan with specific tasks, assignments, \
and equipment needs.

Respond in JSON:
{{
  "actions": [
    {{
      "task": "specific task description",
      "assignee": "Field Crew|Manager|Lab",
      "deadline": "today|tomorrow|this week|next week",
      "equipment": "required equipment",
      "notes": "additional notes"
    }}
  ],
  "estimated_cost": "rough cost estimate",
  "summary": "1-2 sentence plan summary"
}}"""
