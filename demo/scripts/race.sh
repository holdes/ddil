#!/bin/bash
# ============================================================
# cuVS GPU vs CPU Vector Indexing Race
# Triggers force merge on both ES instances and times them
# ============================================================

ES_GPU="http://192.168.1.20:9200"
ES_CPU="http://192.168.1.10:9200"
INDEX="vineyard-imagery"

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║     cuVS GPU vs CPU — HNSW Vector Indexing Race         ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

# Show current state
GPU_COUNT=$(curl -s "$ES_GPU/$INDEX/_count" | python3 -c "import json,sys; print(json.load(sys.stdin)['count'])")
CPU_COUNT=$(curl -s "$ES_CPU/$INDEX/_count" | python3 -c "import json,sys; print(json.load(sys.stdin)['count'])")
echo "  GPU Instance (DGX Spark):      $GPU_COUNT vectors (2048-dim)"
echo "  CPU Instance (Framework):      $CPU_COUNT vectors (2048-dim)"
echo ""

read -p "  Press ENTER to start the race..." _

echo ""
echo "  3..."
sleep 1
echo "  2..."
sleep 1
echo "  1..."
sleep 1
echo "  GO!"
echo ""

START=$(date +%s%N)

# Launch both force merges simultaneously
(
  GPU_START=$(date +%s%N)
  curl -s -X POST "$ES_GPU/$INDEX/_forcemerge?max_num_segments=1" > /dev/null 2>&1
  GPU_END=$(date +%s%N)
  GPU_MS=$(( (GPU_END - GPU_START) / 1000000 ))
  echo "GPU_DONE:$GPU_MS" > /tmp/race_gpu.txt
) &
GPU_PID=$!

(
  CPU_START=$(date +%s%N)
  curl -s -X POST "$ES_CPU/$INDEX/_forcemerge?max_num_segments=1" > /dev/null 2>&1
  CPU_END=$(date +%s%N)
  CPU_MS=$(( (CPU_END - CPU_START) / 1000000 ))
  echo "CPU_DONE:$CPU_MS" > /tmp/race_cpu.txt
) &
CPU_PID=$!

# Live status display
GPU_DONE=false
CPU_DONE=false
while true; do
  sleep 1
  ELAPSED=$(( ($(date +%s%N) - START) / 1000000000 ))

  # Check GPU
  if [ "$GPU_DONE" = false ] && [ -f /tmp/race_gpu.txt ]; then
    GPU_DONE=true
    GPU_TIME=$(cat /tmp/race_gpu.txt | cut -d: -f2)
    GPU_SEC=$(echo "scale=1; $GPU_TIME / 1000" | bc)
  fi

  # Check CPU
  if [ "$CPU_DONE" = false ] && [ -f /tmp/race_cpu.txt ]; then
    CPU_DONE=true
    CPU_TIME=$(cat /tmp/race_cpu.txt | cut -d: -f2)
    CPU_SEC=$(echo "scale=1; $CPU_TIME / 1000" | bc)
  fi

  # Display
  printf "\r  [%3ds] " "$ELAPSED"
  if [ "$GPU_DONE" = true ]; then
    printf "GPU: ✓ %ss  " "$GPU_SEC"
  else
    printf "GPU: ⏱ running...  "
  fi
  if [ "$CPU_DONE" = true ]; then
    printf "CPU: ✓ %ss" "$CPU_SEC"
  else
    printf "CPU: ⏱ running..."
  fi

  if [ "$GPU_DONE" = true ] && [ "$CPU_DONE" = true ]; then
    break
  fi
done

echo ""
echo ""
echo "  ════════════════════════════════════════"
echo "  RESULTS"
echo "  ════════════════════════════════════════"
echo "  GPU (cuVS on DGX Spark):   ${GPU_SEC}s"
echo "  CPU (Framework Desktop):   ${CPU_SEC}s"

SPEEDUP=$(echo "scale=1; $CPU_TIME / $GPU_TIME" | bc 2>/dev/null || echo "N/A")
echo "  Speedup:                   ${SPEEDUP}x"
echo "  ════════════════════════════════════════"
echo ""

# Cleanup
rm -f /tmp/race_gpu.txt /tmp/race_cpu.txt
