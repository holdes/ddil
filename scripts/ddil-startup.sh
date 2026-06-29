#!/bin/bash
# DDIL Kit Startup Banner + Service Health Check

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
NC='\033[0m'

clear

print_logo() {
    local delay=${1:-0.02}
    echo -e "${YELLOW}                                                  ░░░░░░░░░░░░░░░░░░                                ${NC}"; sleep $delay
    echo -e "${YELLOW}                                               ░░░░░░░░░░░░░░░░░░░░░░░░                             ${NC}"; sleep $delay
    echo -e "${YELLOW}                                            ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░                          ${NC}"; sleep $delay
    echo -e "${YELLOW}                                         ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░                       ${NC}"; sleep $delay
    echo -e "${MAGENTA}                         ░░░░░          ${YELLOW}░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░                     ${NC}"; sleep $delay
    echo -e "${MAGENTA}                     ░▒▒▒▒▒▒▒▒▒▒▒░░    ${YELLOW}░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░                     ${NC}"; sleep $delay
    echo -e "${MAGENTA}                  ░░▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒░  ${YELLOW}░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░                   ${NC}"; sleep $delay
    echo -e "${MAGENTA}                 ░▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒░░ ${YELLOW}░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░                  ${NC}"; sleep $delay
    echo -e "${MAGENTA}                ░▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒░  ${YELLOW}░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░                  ${NC}"; sleep $delay
    echo -e "${MAGENTA}               ░▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒░ ${YELLOW}░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░                 ${NC}"; sleep $delay
    echo -e "${MAGENTA}               ░▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒░  ${YELLOW}░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░                ${NC}"; sleep $delay
    echo -e "${MAGENTA}               ░▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒░  ${YELLOW}░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░                ${NC}"; sleep $delay
    echo -e "${MAGENTA}               ░▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒   ${YELLOW}░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░               ${NC}"; sleep $delay
    echo -e "${MAGENTA}               ░░▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒░   ${YELLOW}░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░               ${NC}"; sleep $delay
    echo -e "${MAGENTA}                  ░░░░░░▒▒▒▒▒▒▒▒░  ${YELLOW}░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░               ${NC}"; sleep $delay
    echo -e "${CYAN}            ░░░░░░░░        ░░░░   ${YELLOW}░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░               ${NC}"; sleep $delay
    echo -e "${CYAN}          ░░▒▒▒▒▒▒▒▒▒▒▒░░░░       ${YELLOW}░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░                ${NC}"; sleep $delay
    echo -e "${CYAN}        ░▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒░   ${YELLOW}░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░                 ${NC}"; sleep $delay
    echo -e "${CYAN}      ░░▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒░░  ${YELLOW}░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░   ${BLUE}░░▓▒░░           ${NC}"; sleep $delay
    echo -e "${CYAN}     ░▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒░░ ${YELLOW}░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  ${BLUE}░░▓▓▓▓▓▓▒░         ${NC}"; sleep $delay
    echo -e "${CYAN}    ░▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒░  ${YELLOW}░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  ${BLUE}░░▓▓▓▓▓▓▓▓▓▓▒░       ${NC}"; sleep $delay
    echo -e "${CYAN}    ░▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒░  ${YELLOW}░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░   ${BLUE}░░▓▓▓▓▓▓▓▓▓▓▓▓▓▓░      ${NC}"; sleep $delay
    echo -e "${CYAN}    ▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒░    ${YELLOW}░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░   ${BLUE}░▒▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░     ${NC}"; sleep $delay
    echo -e "${CYAN}    ▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒░░  ░░    ${YELLOW}░░░░░░░░░░░░░░░░░░░░░░░░░░░░  ${BLUE}░▒▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░    ${NC}"; sleep $delay
    echo -e "${CYAN}    ▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒░   ░░▒▒▒▒░░░     ${YELLOW}░░░░░░░░░░░░░░░░░░░   ${BLUE}░▒▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▒    ${NC}"; sleep $delay
    echo -e "${CYAN}    ▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒░░  ░░▒▒▒▒▒▒▒▒▒▒░░░    ${YELLOW}░░░░░░░░░░░░░░  ${BLUE}░░▒▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓    ${NC}"; sleep $delay
    echo -e "${CYAN}    ░▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒░░  ░░▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒░     ${YELLOW}░░░░░░░░   ${BLUE}░▒▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓    ${NC}"; sleep $delay
    echo -e "${CYAN}    ░▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒░   ░░▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒░░░░        ${BLUE}░▒▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓    ${NC}"; sleep $delay
    echo -e "${CYAN}     ░▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒░░  ░░▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒░░░   ${BLUE}░▒▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▒    ${NC}"; sleep $delay
    echo -e "${CYAN}      ░▒▒▒▒▒▒▒▒▒▒▒▒▒▒░░  ░░▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒░   ${BLUE}░▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░    ${NC}"; sleep $delay
    echo -e "${CYAN}       ░░▒▒▒▒▒▒▒▒▒▒░  ░░░▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒░░  ${BLUE}░▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▒░    ${NC}"; sleep $delay
    echo -e "${CYAN}         ░░▒▒▒▒▒▒░   ░░▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒░░ ${BLUE}░▒▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▒░     ${NC}"; sleep $delay
    echo -e "${CYAN}           ░░░▒░░  ░░▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒░  ${BLUE}░▒▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░      ${NC}"; sleep $delay
    echo -e "${CYAN}                 ░░▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒░   ${BLUE}░░▒▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▒░        ${NC}"; sleep $delay
    echo -e "${CYAN}                ░▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒░        ${BLUE}░░░▒▒▒▓▓▓▓▓▓▓▒░░          ${NC}"; sleep $delay
    echo -e "${CYAN}               ░▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒   ${GREEN}░░░░         ░░░░░░             ${NC}"; sleep $delay
    echo -e "${CYAN}               ░▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒░  ${GREEN}░▒▒▒▒▒▒▒▒░░░░░░                  ${NC}"; sleep $delay
    echo -e "${CYAN}               ░▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒   ${GREEN}░▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒░░               ${NC}"; sleep $delay
    echo -e "${CYAN}               ░▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒░   ${GREEN}░▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒░               ${NC}"; sleep $delay
    echo -e "${CYAN}                ░▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒░  ${GREEN}░▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒░               ${NC}"; sleep $delay
    echo -e "${CYAN}                ░▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒░  ${GREEN}░▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒░               ${NC}"; sleep $delay
    echo -e "${CYAN}                 ░▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒░ ${GREEN}░░▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒░░               ${NC}"; sleep $delay
    echo -e "${CYAN}                  ▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒░  ${GREEN}░▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒░                ${NC}"; sleep $delay
    echo -e "${CYAN}                  ░▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒░  ${GREEN}░▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒░░                 ${NC}"; sleep $delay
    echo -e "${CYAN}                   ░▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒   ${GREEN}░▒▒▒▒▒▒▒▒▒▒▒▒▒▒░░                  ${NC}"; sleep $delay
    echo -e "${CYAN}                     ░▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒░     ${GREEN}░░▒▒▒▒▒▒▒▒▒░░                     ${NC}"; sleep $delay
    echo -e "${CYAN}                      ░▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒░                                        ${NC}"; sleep $delay
    echo -e "${CYAN}                       ░░▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒░                                          ${NC}"; sleep $delay
    echo -e "${CYAN}                          ░░▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒░░                                            ${NC}"; sleep $delay
    echo -e "${CYAN}                             ░░▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒░░                                               ${NC}"; sleep $delay
    echo -e "${CYAN}                                ░░░░░░▒▒▒▒▒▒░░░░░░                                                  ${NC}"; sleep $delay
}

print_logo 0.02
echo ""
echo ""
echo -e "${WHITE}              ███████╗██╗      █████╗ ███████╗████████╗██╗ ██████╗${NC}"
echo -e "${WHITE}              ██╔════╝██║     ██╔══██╗██╔════╝╚══██╔══╝██║██╔════╝${NC}"
echo -e "${WHITE}              █████╗  ██║     ███████║███████╗   ██║   ██║██║     ${NC}"
echo -e "${WHITE}              ██╔══╝  ██║     ██╔══██║╚════██║   ██║   ██║██║     ${NC}"
echo -e "${WHITE}              ███████╗███████╗██║  ██║███████║   ██║   ██║╚██████╗${NC}"
echo -e "${WHITE}              ╚══════╝╚══════╝╚═╝  ╚═╝╚══════╝   ╚═╝   ╚═╝ ╚═════╝${NC}"
echo ""
echo -e "${WHITE}═══════════════════════════════════════════════════════════════════════════════════════════${NC}"
echo -e "${MAGENTA}               DDIL Vineyard Intelligence — Context Engineering Anywhere                    ${NC}"
echo -e "${WHITE}═══════════════════════════════════════════════════════════════════════════════════════════${NC}"
echo ""
sleep 1

# Service health checks
echo -e "${CYAN}  Checking services...${NC}"
echo ""

check_service() {
    local name="$1"
    local url="$2"
    local timeout="${3:-3}"
    local code
    code=$(curl -s -o /dev/null -w "%{http_code}" --max-time "$timeout" "$url" 2>/dev/null)
    if [ "$code" = "200" ] || [ "$code" = "302" ]; then
        echo -e "    ${GREEN}✓${NC} $name"
    else
        echo -e "    ${RED}✗${NC} $name ${YELLOW}(starting...)${NC}"
    fi
}

echo -e "  ${WHITE}Framework Desktop (192.168.1.10)${NC}"
check_service "Elasticsearch CPU    :9200" "http://192.168.1.10:9200"
check_service "Kibana               :5601" "http://192.168.1.10:5601"
check_service "Backend API          :8000" "http://192.168.1.10:8000/api/health"
check_service "Frontend             :3000" "http://192.168.1.10:3000"
check_service "Ollama (embed)      :11434" "http://192.168.1.10:11434"
echo ""
echo -e "  ${WHITE}DGX Spark (192.168.1.20)${NC}"
check_service "Elasticsearch GPU    :9200" "http://192.168.1.20:9200"
check_service "Ollama (LLM)        :11434" "http://192.168.1.20:11434"
echo ""

# Data summary
echo -e "  ${WHITE}Data Indexed${NC}"
for idx in vineyard-wine vineyard-npk vineyard-imagery vineyard-soil vineyard-harvest; do
    count=$(curl -s --max-time 2 "http://192.168.1.10:9200/${idx}/_count" 2>/dev/null | python3 -c "import json,sys; print(json.load(sys.stdin).get('count',0))" 2>/dev/null || echo "?")
    printf "    %-25s %s docs\n" "$idx" "$count"
done
echo ""

echo -e "${WHITE}═══════════════════════════════════════════════════════════════════════════════════════════${NC}"
echo -e "  ${CYAN}Frontend:${NC}  http://192.168.1.10:3000"
echo -e "  ${CYAN}Kibana:${NC}    http://192.168.1.10:5601"
echo -e "  ${CYAN}API Docs:${NC}  http://192.168.1.10:8000/docs"
echo -e "${WHITE}═══════════════════════════════════════════════════════════════════════════════════════════${NC}"
echo ""
