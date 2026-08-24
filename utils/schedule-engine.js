/*
 * --------------------------------------------------
 * Schedule Engine
 * --------------------------------------------------
 *
 * Day numbers:
 *
 * 0 = Sunday
 * 1 = Monday
 * 2 = Tuesday
 * 3 = Wednesday
 * 4 = Thursday
 * 5 = Friday
 * 6 = Saturday
 *
 */


/*
 * --------------------------------------------------
 * Convert HH:MM into minutes since midnight
 * --------------------------------------------------
 */

function timeToMinutes(time) {

    const [
        hours,
        minutes
    ] = time.split(":").map(Number);


    return (
        hours * 60 +
        minutes
    );

}


/*
 * --------------------------------------------------
 * Create a Date using a date + HH:MM
 * --------------------------------------------------
 */

function createDateAtTime(
    date,
    time
) {

    const [
        hours,
        minutes
    ] = time.split(":").map(Number);


    const result =
        new Date(date);


    result.setHours(
        hours,
        minutes,
        0,
        0
    );


    return result;

}


/*
 * --------------------------------------------------
 * Determine whether a schedule is active NOW
 * --------------------------------------------------
 */

function isScheduleCurrentlyActive(
    schedule,
    now = new Date()
) {

    const currentDay =
        now.getDay();


    const currentMinutes =
        now.getHours() * 60 +
        now.getMinutes();


    const startMinutes =
        timeToMinutes(
            schedule.startTime
        );


    const endMinutes =
        timeToMinutes(
            schedule.endTime
        );


    /*
     * ----------------------------------------------
     * Normal schedule
     *
     * Example:
     *
     * 09:00 → 17:00
     * ----------------------------------------------
     */

    if (
        endMinutes > startMinutes
    ) {

        /*
         * Current day must be selected.
         */

        if (
            !schedule.days.includes(
                currentDay
            )
        ) {

            return false;

        }


        return (
            currentMinutes >=
                startMinutes
            &&
            currentMinutes <
                endMinutes
        );

    }


    /*
     * ----------------------------------------------
     * Overnight schedule
     *
     * Example:
     *
     * 23:00 → 02:00
     *
     * Monday means:
     *
     * Monday 23:00
     * →
     * Tuesday 02:00
     * ----------------------------------------------
     */

    if (
        currentMinutes >=
        startMinutes
    ) {

        /*
         * Starting portion of the
         * selected day.
         */

        return schedule.days.includes(
            currentDay
        );

    }


    if (
        currentMinutes <
        endMinutes
    ) {

        /*
         * Early-morning portion belongs
         * to the previous day's schedule.
         */

        const previousDay =
            (
                currentDay + 6
            ) % 7;


        return schedule.days.includes(
            previousDay
        );

    }


    return false;

}


/*
 * --------------------------------------------------
 * Get next schedule transition
 * --------------------------------------------------
 *
 * Returns:
 *
 * {
 *   type: "start" | "end",
 *   timestamp: ...
 * }
 *
 * --------------------------------------------------
 */

function getNextScheduleTransition(
    schedule,
    now = new Date()
) {

    const candidates = [];


    /*
     * Check the next 8 calendar days.
     *
     * 8 days gives us enough room to
     * cover a complete weekly cycle.
     */

    for (
        let offset = 0;
        offset <= 8;
        offset++
    ) {

        const candidateDate =
            new Date(now);


        candidateDate.setDate(
            candidateDate.getDate() +
            offset
        );


        const candidateDay =
            candidateDate.getDay();


        /*
         * Only selected days
         * can start a schedule.
         */

        if (
            schedule.days.includes(
                candidateDay
            )
        ) {

            const startDate =
                createDateAtTime(
                    candidateDate,
                    schedule.startTime
                );


            let endDate =
                createDateAtTime(
                    candidateDate,
                    schedule.endTime
                );


            /*
             * Overnight schedule.
             */

            const startMinutes =
                timeToMinutes(
                    schedule.startTime
                );


            const endMinutes =
                timeToMinutes(
                    schedule.endTime
                );


            if (
                endMinutes <=
                startMinutes
            ) {

                endDate.setDate(
                    endDate.getDate() +
                    1
                );

            }


            if (
                startDate.getTime() >
                now.getTime()
            ) {

                candidates.push({

                    type: "start",

                    timestamp:
                        startDate.getTime()

                });

            }


            if (
                endDate.getTime() >
                now.getTime()
            ) {

                candidates.push({

                    type: "end",

                    timestamp:
                        endDate.getTime()

                });

            }

        }

    }


    /*
     * Find earliest future transition.
     */

    if (
        candidates.length === 0
    ) {

        return null;

    }


    candidates.sort(
        (a, b) =>
            a.timestamp -
            b.timestamp
    );


    return candidates[0];

}