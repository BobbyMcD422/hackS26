// @grant        GM_registerMenuCommand


(async function() {
    'use strict';

    (function () {
    const origOpen = XMLHttpRequest.prototype.open;

    // Define Some Variables
    const testing = false;
    let prevCRN = null;
    let endOfSemester = "";
    let startOfSemester = "";
    const { DateTime } = luxon;
    const now = DateTime.now();

    // Define ClassList So The ICS Builder Can Use It
    let classList = [];

    /**
      * (GENERIC FILE CONVERTER FUNCTION I FOUND ONLINE)
      *
      * Triggers a browser download of a file created from a string.
      * @param {string} content - The text content of the file.
      * @param {string} fileName - The name of the file (e.g., 'event.ics').
      * @param {string} contentType - The MIME type (e.g., 'text/calendar').
      */
        function createFile(content, fileName, contentType) {
            const blob = new Blob([content], { type: contentType });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a); // Required for some browsers
            a.click();
            // Cleanup
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
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
        // Return Var (as usual)
        let finalDate = "";
        // Translate my Days Array Into Something Luxon Can Use
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
            hour: time.slice(0,2),
            minute: time.slice(2,4),
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

    // Check If Our Days Array Has Any Active Days
    function hasActiveDays(daysObj) {
        return Object.values(daysObj).some(Boolean);
    }

    // Build An ICS File Based Given The Classes In An Array
    function BuildICS(classes, lastDay) {
        // Define With The Default Required Fields
        let ICS_String = "BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//BobbyMcD422//Banner Schedule Export//EN\n";
        // Add Classes From Array And All Of Their Fields (c bc you can't call an obj class :( )
        classes.forEach((c) => {
            // Open Event
            ICS_String += "BEGIN:VEVENT\n";
            for (const [key, value] of Object.entries(c)) {
                if(key != "DAYS") {
                    ICS_String += `${key}:${value}\n`;
                }
                else {
                    const byDays = Object.entries(value)
                    .filter(([_, isActive]) => isActive)
                    .map(([day]) => dayMap[day])
                    .join(",");

                    ICS_String += `RRULE:FREQ=WEEKLY;BYDAY=${byDays};UNTIL=${lastDay}\n`;
                }
            }
            // Close Event
            ICS_String += "END:VEVENT\n";
        });

        ICS_String += "END:VCALENDAR\n";

        return createFile(ICS_String, 'event.ics', 'text/calendar;charset=utf-8');
    }

    /* Send Reqs to Get Additional Time and Location Data not included in Original Intercepted Data
     * It returns an Array of (seemingly) Duplicate Data in 0 and 1 Indexes
     */
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

            const fullData = await response.json();
            // Return a Single Entry instead of 2 Entry Array
            return fullData;
        } catch (err) {
            console.error("Request failed:", err);
            return null;
        }
    }

    // Make A Button On The Page To Download The File
    GM_registerMenuCommand("Export Schedule", () => {
        BuildICS(classList, endOfSemester);
    });

    // Intercept and Organize The Info that We Need + Save it To the Classes Array
    XMLHttpRequest.prototype.open = function (method, url) {
        // Check for the Registration Loading Your Classes
        if (url.includes("getRegistrationEvents")) {
            // Run This When It Stops Loading / Fully Loads In
            this.addEventListener("load", async function () {
                try {
                    // Unpack The JSON Data Into an actual String
                    const courses = JSON.parse(this.responseText);
                    const uniqueCourses = [...new Map(
                        courses.map(c => [c.crn, c])
                    ).values()];
                    // Clear Out Old Data (this script will run everytime you change terms)
                    classList = [];
                    // UID For Class
                    let UID = 1;
                    let start = null;
                    prevCRN = null;

                    for (const course of uniqueCourses) {
                        /* CANT DO THIS | NOT ALL COURSES HAVE A SINGLE TIME PER WEEK
                        if(course.crn != prevCRN) {
                        */
                            // Version 2 Addition | Get Meet Times + Location

                            const fullData = await getFacultyMeetingTimes(course.term, course.crn);
                            for (const entry of fullData.fmt) {
                                const data = entry.meetingTime;

                                let daysArray = {SATURDAY: data.saturday, MONDAY: data.monday, TUESDAY: data.tuesday, WEDNESDAY: data.wednesday, THURSDAY: data.thursday, FRIDAY: data.friday, SUNDAY: data.sunday};

                                // Accounts for Some Online Courses That Aren't Assigned to Any Days
                                if (!data.beginTime || !data.endTime || !hasActiveDays(daysArray)) {
                                    if(testing) {
                                        console.log("Skipping unscheduled/online section:", course.crn, data);
                                    }
                                    continue;
                                }

                            if(prevCRN == null) {
                                let cutoff = DateTime.fromFormat(data.endDate, "MM/dd/yyyy");
                                start = DateTime.fromFormat(data.startDate, "MM/dd/yyyy");
                                startOfSemester = start.toFormat("yyyyMMdd'T'HHmmss");
                                endOfSemester = cutoff.toFormat("yyyyMMdd'T'HHmmss");
                            }

                            // Take From New Function To Correctly Map In Calendar
                            let newStart = firstDate(start, daysArray, data.beginTime);
                            let newEnd = firstDate(start, daysArray, data.endTime);
                            // Add Only Necessary Info To An Obj | Reformat for ICal
                            const newClass = {
                                SUMMARY: `${course.title} ${course.subject}${course.courseNumber}`,
                                UID: `${course.subject}${course.courseNumber}${UID}`,
                                DTSTAMP: now.toFormat("yyyyMMdd'T'HHmmss"),
                                DTSTART: newStart.toFormat("yyyyMMdd'T'HHmmss"), // Start Date and Time Of First Class
                                DTEND: newEnd.toFormat("yyyyMMdd'T'HHmmss"), // End Date and Time Of First Class
                                DESCRIPTION: `Building: ${data.buildingDescription}`,
                                LOCATION: `${data.building}${data.room}`,
                                DAYS: daysArray,
                            };
                            // Add It To Our ClassList
                            classList.push(newClass);

                            // Print Course Objs Into Console For Troubleshooting
                            if(testing) {
                                console.log("Course Meet Data");
                                console.log("Course Received:");
                                console.log(course);
                                console.log("Course Stripped Down / Converted");
                                console.log(endOfSemester);
                                console.log(data);
                                console.log(startOfSemester);
                                console.log(data.beginTime);
                                console.log(fullData);
                                console.log(classList[UID - 1]);
                            }
                            // Increment UID + Previous CRN
                            UID++;
                            prevCRN = course.crn;
                            }
                    };
                } catch (e) {
                    console.error("Failed to parse schedule JSON", e);
                }
            });
        }

        return origOpen.apply(this, arguments);
    };
    })();
})();