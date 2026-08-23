const websiteName =
    document.getElementById("websiteName");

const countdown =
    document.getElementById("countdown");

const status =
    document.getElementById("status");

const backButton =
    document.getElementById("backButton");


/*
 * Get data from URL parameters.
 *
 * Example:
 *
 * blocked.html?domain=youtube.com&expiresAt=123456
 */

const params =
    new URLSearchParams(
        window.location.search
    );


const domain =
    params.get("domain");


const expiresAt =
    Number(
        params.get("expiresAt")
    );


if (domain) {

    websiteName.textContent =
        domain;

}


/*
 * Format milliseconds
 * into HH:MM:SS
 */

function formatTime(
    milliseconds
) {

    if (milliseconds <= 0) {

        return "00:00:00";

    }


    const totalSeconds =
        Math.ceil(
            milliseconds / 1000
        );


    const hours =
        Math.floor(
            totalSeconds / 3600
        );


    const minutes =
        Math.floor(
            (totalSeconds % 3600) / 60
        );


    const seconds =
        totalSeconds % 60;


    return [

        String(hours)
            .padStart(2, "0"),

        String(minutes)
            .padStart(2, "0"),

        String(seconds)
            .padStart(2, "0")

    ].join(":");

}


/*
 * Update countdown
 */

function updateCountdown() {

    const remaining =
        expiresAt -
        Date.now();


    if (remaining <= 0) {

        countdown.textContent =
            "00:00:00";

        status.textContent =
            "Your focus session has ended.";

        return;

    }


    countdown.textContent =
        formatTime(
            remaining
        );

}


updateCountdown();


setInterval(
    updateCountdown,
    1000
);


/*
 * Go back
 */

backButton.addEventListener(
    "click",
    () => {

        history.back();

    }
);