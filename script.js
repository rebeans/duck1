let deferredPrompt;

window.addEventListener('beforeinstallprompt', (e) => {
    // 기본 브라우저 설치 배너 막기
    e.preventDefault();
    deferredPrompt = e;

    // 버튼이나 안내 메시지 띄우기
    const installBanner = document.createElement('button');
    installBanner.textContent = "홈 화면에 추가하기";
    installBanner.style.position = 'fixed';
    installBanner.style.top = '10px';
    installBanner.style.left = '10px';
    installBanner.style.padding = '10px';
    installBanner.style.background = '#2196F3';
    installBanner.style.color = 'white';
    installBanner.style.border = 'none';
    installBanner.style.borderRadius = '5px';
    installBanner.style.zIndex = '9999';
    installBanner.style.transition = 'opacity 2s ease'; // 2초 동안 서서히 투명해짐
    installBanner.style.opacity = '1';

    document.body.appendChild(installBanner);

    // 5초 뒤에 투명해지기 시작
    setTimeout(() => {
        installBanner.style.opacity = '0';
    }, 3000);

    // 7초 뒤에 완전히 제거
    setTimeout(() => {
        installBanner.remove();
    }, 5000);

    document.body.appendChild(installBanner);

    installBanner.addEventListener('click', async () => {
        if (deferredPrompt) {
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            console.log(`사용자 반응: ${outcome}`);
            deferredPrompt = null;
            installBanner.remove(); // 버튼 숨기기
        }
    });
});

function getSeoulDate() {
    const now = new Date();
    const seoulTime = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
    const year = seoulTime.getFullYear();
    const month = String(seoulTime.getMonth() + 1).padStart(2, '0');
    const day = String(seoulTime.getDate()).padStart(2, '0');
    return `${year}${month}${day}`;
}

function getHourMinute(timeString) {
    const str = String(timeString);
    return str.slice(-4);
}

async function fetchData() {
    const ik = 'C%2BLRWOiaGz%2F37JyFChlFuE2K3MteVH2dF0wQudShtyxS5%2FWfZlS8wqMd48KJpFlhSD28mtZIfX4v3R%2Fdbghscg%3D%3D';
    const urlArr = `https://apis.data.go.kr/B551177/statusOfAllFltDeOdp/getFltArrivalsDeOdp?serviceKey=${ik}&searchDate=${getSeoulDate()}&numOfRows=2000&type=json`;
    const urlDep = `https://apis.data.go.kr/B551177/statusOfAllFltDeOdp/getFltDeparturesDeOdp?serviceKey=${ik}&searchDate=${getSeoulDate()}&numOfRows=2000&type=json`;

    const [arrResponse, depResponse] = await Promise.all([
        fetch(urlArr),
        fetch(urlDep)
    ]);

    const arrData = await arrResponse.json();
    const depData = await depResponse.json();

    return { arrData, depData };
}

function getClassName(remark) {
    const classMap = {
        "탑승중": "remark-bor",
        "탑승마감": "remark-bor-e",
        "마감예정": "remark-bor-ee",
        "착륙": "remark-arr"
    };
    return classMap[remark] || "";
}

function filterAndGroupData(dataArr, dataDep) {
    const filteredData = [];

    dataArr.response.body.items.forEach(item => {
        if (item.terminalId === "P01" && item.codeshare !== "Slave" && item.remark !== "도착" && item.gateNumber) {
            filteredData.push({
                arr_dep: "A",
                estimatedDateTime: getHourMinute(item.estimatedDatetime) || "",
                flightId: item.flightId || "",
                aircraftSubtype: item.aircraftSubtype ? `(${item.aircraftSubtype})` : "",
                gatenumber: item.gateNumber || "",
                remark: item.remark || "",
                class_name: getClassName(item.remark)
            });
        }
    });

    dataDep.response.body.items.forEach(item => {
        if (item.terminalId === "P01" && item.codeshare !== "Slave" && item.remark !== "출발" && item.gateNumber) {
            let remark = item.remark;
            if (["체크인오픈", "탑승준비", "체크인마감"].includes(remark)) {
                remark = "";
            }
            filteredData.push({
                arr_dep: "D",
                estimatedDateTime: getHourMinute(item.estimatedDatetime) || "",
                flightId: item.flightId || "",
                aircraftSubtype: item.aircraftSubtype ? `(${item.aircraftSubtype})` : "",
                gatenumber: item.gateNumber || "",
                remark: remark || "",
                class_name: getClassName(remark)
            });
        }
    });

    const gateData = {};
    filteredData.forEach(item => {
        const gateNumber = item.gatenumber;
        if (!gateData[gateNumber]) {
            gateData[gateNumber] = {
                gatenumber: gateNumber,
                flights: []
            };
        }
        gateData[gateNumber].flights.push(item);
    });

    // Sort each gate's flights by estimatedDateTime
    Object.values(gateData).forEach(gate => {
        gate.flights.sort((a, b) => new Date(a.estimatedDateTime) - new Date(b.estimatedDateTime));
    });

    return gateData;
}

function renderData(gateData) {
    const container = document.getElementById('flight-info');
    const table = document.createElement('table');

    // Create header row
    const headerRow = document.createElement('tr');
    headerRow.innerHTML = '<th></th>';
    const maxFlights = Math.max(...Object.values(gateData).map(gate => gate.flights.length));
    for (let i = 0; i < maxFlights; i++) {
        headerRow.innerHTML += `<th>${i + 1}</th>`;
    }
    table.appendChild(headerRow);

    // Create rows for each gate
    for (const gateNumber in gateData) {
        const gate = gateData[gateNumber];
        const row = document.createElement('tr');
        row.innerHTML = `<td>${gateNumber}</td>`;
        gate.flights.forEach(flight => {
            const className = flight.class_name;
            let cellContent = '<div class="content-all">';
            for (const key in flight) {
                if (key !== "class_name" && key !== "gatenumber") {
                    cellContent += `<p class="compact">${flight[key]}</p>`;
                }
            }
            cellContent += '</div>';
            row.innerHTML += `<td class="${className}">${cellContent}</td>`;
        });

        // Add empty cells if there are fewer flights than maxFlights
        if (gate.flights.length < maxFlights) {
            for (let i = 0; i < maxFlights - gate.flights.length; i++) {
                row.innerHTML += '<td></td>';
            }
        }

        table.appendChild(row);
    }

    container.appendChild(table);
}

document.addEventListener('DOMContentLoaded', async () => {
    const { arrData, depData } = await fetchData();
    const gateData = filterAndGroupData(arrData, depData);
    renderData(gateData);

    let timer;
    const longPressDelay = 500;
    let touchStartDistance = 0;
    let isDragging = false;
    let startX, startY;

    const table = document.getElementById('flight-info');
    table.addEventListener('mousedown', startMouseTimer);
    table.addEventListener('mouseup', clearTimer);
    table.addEventListener('mouseleave', clearTimer);
    table.addEventListener('mousemove', handleMouseMove);
    table.addEventListener('touchstart', startTouchTimer);
    table.addEventListener('touchend', clearTimer);
    table.addEventListener('touchcancel', clearTimer);
    table.addEventListener('touchmove', detectPinchZoomOrDrag);

    function startMouseTimer(event) {
        const cell = event.target.closest('td');
        if (!cell) return;
        clearTimer();
        isDragging = false;
        startX = event.pageX;
        startY = event.pageY;
        timer = setTimeout(() => {
            if (!isDragging) {
                handleLongPress(cell);
            }
        }, longPressDelay);
    }

    function startTouchTimer(event) {
        const cell = event.target.closest('td');
        if (!cell) return;
        clearTimer();
        isDragging = false;
        if (event.touches.length === 1) {
            startX = event.touches[0].pageX;
            startY = event.touches[0].pageY;
            timer = setTimeout(() => {
                if (!isDragging) {
                    handleLongPress(cell);
                }
            }, longPressDelay);
        } else if (event.touches.length === 2) {
            touchStartDistance = getDistance(event.touches[0], event.touches[1]);
        }
    }

    function handleLongPress(cell) {
        const div = cell.querySelector('div');
        if (div) {
            const paragraphs = div.getElementsByTagName('p');
            if (paragraphs.length >= 3) {
                let flightNumber = paragraphs[2].innerText.trim();
                if (flightNumber) {
                    flightNumber = flightNumber.replace(/^([A-Z]+)0+/, '$1');
                    const url = `https://www.flightradar24.com/${flightNumber}?force_browser=1`;
                    window.location.href = url;
                }
            }
        }
    }

    function clearTimer() {
        if (timer) {
            clearTimeout(timer);
            timer = null;
        }
    }

    function handleMouseMove(event) {
        if (Math.abs(event.pageX - startX) > 10 || Math.abs(event.pageY - startY) > 10) {
            isDragging = true;
            clearTimer();
        }
    }

    function detectPinchZoomOrDrag(event) {
        if (event.touches.length === 2) {
            const currentDistance = getDistance(event.touches[0], event.touches[1]);
            if (Math.abs(currentDistance - touchStartDistance) > 10) {
                clearTimer();
            }
        } else if (event.touches.length === 1) {
            if (Math.abs(event.touches[0].pageX - startX) > 10 || Math.abs(event.touches[0].pageY - startY) > 10) {
                isDragging = true;
                clearTimer();
            }
        }
    }

    function getDistance(touch1, touch2) {
        return Math.sqrt(Math.pow(touch2.pageX - touch1.pageX, 2) + Math.pow(touch2.pageY - touch1.pageY, 2));
    }
});