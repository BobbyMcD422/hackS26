(function() {
    'use strict';

    if (window.__maristIcsPageScriptLoaded) {
        return;
    }

    window.__maristIcsPageScriptLoaded = true;

    const origOpen = XMLHttpRequest.prototype.open;

    const testing = false;
    let endOfSemester = "";
    let currentTermFileName = "schedule.ics";
    const { DateTime } = luxon;
    const now = DateTime.now().toUTC();
    let classList = [];

    function createFile(content, fileName, contentType) {
        const blob = new Blob([content], { type: contentType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    function exportSchedule() {
        if (!classList.length || !endOfSemester) {
            window.alert("Schedule data is still loading or no exportable classes were found yet.");
            return;
        }

        BuildICS(classList, endOfSemester, currentTermFileName);
    }

    function getTermFileNameFromCode(termCode) {
        const termText = String(termCode || "").trim();
        const match = termText.match(/^(\d{4})(\d{2})/);

        if (!match) {
            return "schedule.ics";
        }

        const [, year, suffix] = match;
        const seasonMap = {
            "20": "spring",
            "40": "fall"
        };
        const season = seasonMap[suffix];

        if (!season) {
            return `${year}${suffix}.ics`;
        }

        return `${season}${year}.ics`;
    }

    function ensureExportButton() {
        const existingButton = document.getElementById("marist-ics-export-button");
        if (existingButton) {
            return existingButton;
        }

        const button = document.createElement("button");
        button.id = "marist-ics-export-button";
        button.type = "button";
        button.textContent = "Export Schedule";
        button.style.position = "sticky";
        button.style.top = "220px";
        button.style.left = "400px";
        button.style.zIndex = "2147483647";
        button.style.padding = "10px 14px";
        button.style.border = "none";
        button.style.borderRadius = "8px";
        button.style.background = "#1f5eff";
        button.style.color = "#ffffff";
        button.style.fontSize = "14px";
        button.style.fontWeight = "600";
        button.style.cursor = "pointer";
        button.style.boxShadow = "0 8px 24px rgba(0, 0, 0, 0.18)";
        button.addEventListener("click", exportSchedule);

        const resetButtonPosition = () => {
            button.style.position = "static";
            button.style.top = "";
            button.style.right = "";
            button.style.marginLeft = "";
        };

        const tryMountNearPrintButton = () => {
            const printButton = document.querySelector("#lookup-registrations #print-button");
            const printButtonParent = printButton?.parentElement;

            if (!printButton || !printButtonParent) {
                return false;
            }

            resetButtonPosition();

            const buttonWrap = document.createElement("div");
            buttonWrap.style.display = "inline-flex";
            buttonWrap.style.alignItems = "center";
            buttonWrap.style.marginLeft = "12px";
            buttonWrap.appendChild(button);

            if (!document.getElementById(button.id)) {
                printButtonParent.insertBefore(buttonWrap, printButton.nextSibling);
                return true;
            }

            return false;
        };

        const tryMountInControlsRow = () => {
            const controlsRow = document.querySelector("#lookup-registrations .row-with-select");
            if (!controlsRow) {
                return false;
            }

            controlsRow.style.display = "flex";
            controlsRow.style.alignItems = "center";
            controlsRow.style.flexWrap = "wrap";
            controlsRow.style.gap = "12px";

            resetButtonPosition();
            button.style.marginLeft = "auto";

            if (!document.getElementById(button.id)) {
                controlsRow.appendChild(button);
                return true;
            }

            return false;
        };

        const tryMountFallback = () => {
            button.style.position = "fixed";
            button.style.top = "16px";
            button.style.right = "16px";
            button.style.marginLeft = "";

            if (document.body && !document.getElementById(button.id)) {
                document.body.appendChild(button);
                return true;
            }

            return false;
        };

        const mountButton = () => {
            return tryMountNearPrintButton() || tryMountInControlsRow() || tryMountFallback();
        };

        const mountButtonWhenReady = () => {
            if (mountButton()) {
                return;
            }

            const observer = new MutationObserver(() => {
                if (tryMountNearPrintButton() || tryMountInControlsRow()) {
                    observer.disconnect();
                }
            });

            observer.observe(document.documentElement, { childList: true, subtree: true });

            window.setTimeout(() => {
                observer.disconnect();
                if (!document.getElementById(button.id)) {
                    tryMountFallback();
                }
            }, 8000);
        };

        mountButtonWhenReady();

        return button;
    }

    const dayToNumber = {
        MONDAY: 1,
        TUESDAY: 2,
        WEDNESDAY: 3,
        THURSDAY: 4,
        FRIDAY: 5,
        SATURDAY: 6,
        SUNDAY: 7
    };

    function firstDate(start, days, time) {
        let finalDate = "";
        const luxonDays = Object.entries(days)
            .filter(([_, isActive]) => isActive)
            .map(([day]) => dayToNumber[day]);

        let minOffset = Infinity;

        for (const day of luxonDays) {
            const offset = (day - start.weekday + 7) % 7;
            if (offset < minOffset) {
                minOffset = offset;
            }
        }

        finalDate = start.plus({ days: minOffset });

        finalDate = finalDate.set({
            hour: time.slice(0, 2),
            minute: time.slice(2, 4),
            second: 0,
            millisecond: 0
        });

        return finalDate;
    }

    const dayMap = {
        MONDAY: "MO",
        TUESDAY: "TU",
        WEDNESDAY: "WE",
        THURSDAY: "TH",
        FRIDAY: "FR",
        SATURDAY: "SA",
        SUNDAY: "SU"
    };

    function hasActiveDays(daysObj) {
        return Object.values(daysObj).some(Boolean);
    }

    function escapeICSText(value) {
        return String(value ?? "")
            .replace(/\\/g, "\\\\")
            .replace(/\r?\n/g, "\\n")
            .replace(/,/g, "\\,")
            .replace(/;/g, "\\;");
    }

    function buildLocation(building, room) {
        const parts = [building, room].filter((part) => part && part !== "null");
        return parts.join(" ").trim();
    }

    function buildDescription(buildingDescription) {
        if (!buildingDescription || buildingDescription === "null") {
            return "Building: TBA";
        }

        return `Building: ${buildingDescription}`;
    }

    function BuildICS(classes, lastDay, fileName) {
        const lineBreak = "\r\n";
        let ICS_String = [
            "BEGIN:VCALENDAR",
            "VERSION:2.0",
            "PRODID:-//BobbyMcD422//Banner Schedule Export//EN",
            "CALSCALE:GREGORIAN",
            "METHOD:PUBLISH"
        ].join(lineBreak) + lineBreak;

        classes.forEach((c) => {
            ICS_String += `BEGIN:VEVENT${lineBreak}`;
            for (const [key, value] of Object.entries(c)) {
                if (key !== "DAYS") {
                    ICS_String += `${key}:${escapeICSText(value)}${lineBreak}`;
                } else {
                    const byDays = Object.entries(value)
                        .filter(([_, isActive]) => isActive)
                        .map(([day]) => dayMap[day])
                        .join(",");

                    ICS_String += `RRULE:FREQ=WEEKLY;BYDAY=${byDays};UNTIL=${lastDay}${lineBreak}`;
                }
            }
            ICS_String += `END:VEVENT${lineBreak}`;
        });

        ICS_String += `END:VCALENDAR${lineBreak}`;

        return createFile(ICS_String, fileName, 'text/calendar;charset=utf-8');
    }

    async function getFacultyMeetingTimes(term, courseReferenceNumber) {
        try {
            const url = `https://ssb1-reg-prod.banner.marist.edu/StudentRegistrationSsb/ssb/searchResults/getFacultyMeetingTimes?term=${encodeURIComponent(term)}&courseReferenceNumber=${encodeURIComponent(courseReferenceNumber)}`;

            const response = await fetch(url, {
                method: "GET",
                credentials: "include",
                headers: {
                    "Accept": "application/json, text/javascript, */*; q=0.01"
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            return await response.json();
        } catch (err) {
            console.error("Request failed:", err);
            return null;
        }
    }

    window.setTimeout(() => {
        ensureExportButton();
    }, 500);

    XMLHttpRequest.prototype.open = function(method, url) {
        if (typeof url === "string" && url.includes("getRegistrationEvents")) {
            this.addEventListener("load", async function() {
                try {
                    const courses = JSON.parse(this.responseText);
                    const uniqueCourses = [...new Map(
                        courses.map((c) => [c.crn, c])
                    ).values()];

                    classList = [];
                    currentTermFileName = getTermFileNameFromCode(uniqueCourses[0]?.term);
                    let UID = 1;
                    let start = null;
                    let isFirstMeeting = true;

                    for (const course of uniqueCourses) {
                        const fullData = await getFacultyMeetingTimes(course.term, course.crn);
                        if (!fullData || !Array.isArray(fullData.fmt)) {
                            continue;
                        }

                        for (const entry of fullData.fmt) {
                            const data = entry.meetingTime;
                            const daysArray = {
                                SATURDAY: data.saturday,
                                MONDAY: data.monday,
                                TUESDAY: data.tuesday,
                                WEDNESDAY: data.wednesday,
                                THURSDAY: data.thursday,
                                FRIDAY: data.friday,
                                SUNDAY: data.sunday
                            };

                            if (!data.beginTime || !data.endTime || !hasActiveDays(daysArray)) {
                                if (testing) {
                                    console.log("Skipping unscheduled/online section:", course.crn, data);
                                }
                                continue;
                            }

                            if (isFirstMeeting) {
                                const cutoff = DateTime.fromFormat(data.endDate, "MM/dd/yyyy");
                                start = DateTime.fromFormat(data.startDate, "MM/dd/yyyy");
                                endOfSemester = cutoff.endOf("day").toFormat("yyyyMMdd'T'HHmmss");
                                isFirstMeeting = false;
                            }

                            const newStart = firstDate(start, daysArray, data.beginTime);
                            const newEnd = firstDate(start, daysArray, data.endTime);
                            const newClass = {
                                SUMMARY: `${course.title} ${course.subject}${course.courseNumber}`,
                                UID: `${course.subject}${course.courseNumber}${UID}@mymarist-ics-generator`,
                                DTSTAMP: now.toFormat("yyyyMMdd'T'HHmmss'Z'"),
                                DTSTART: newStart.toFormat("yyyyMMdd'T'HHmmss"),
                                DTEND: newEnd.toFormat("yyyyMMdd'T'HHmmss"),
                                DESCRIPTION: buildDescription(data.buildingDescription),
                                LOCATION: buildLocation(data.building, data.room),
                                DAYS: daysArray,
                            };

                            classList.push(newClass);

                            if (testing) {
                                console.log("Course Meet Data");
                                console.log("Course Received:");
                                console.log(course);
                                console.log("Course Stripped Down / Converted");
                                console.log(endOfSemester);
                                console.log(data);
                                console.log(data.beginTime);
                                console.log(fullData);
                                console.log(classList[UID - 1]);
                            }

                            UID++;
                        }
                    }
                } catch (e) {
                    console.error("Failed to parse schedule JSON", e);
                }
            });
        }

        return origOpen.apply(this, arguments);
    };
})();
