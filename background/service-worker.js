/*
 * ==================================================
 * FocusGuard - Service Worker
 * ==================================================
 *
 * Responsibilities:
 *
 * 1. Receive block requests from popup
 * 2. Normalize and validate domains
 * 3. Create DNR redirect rules
 * 4. Store active blocks
 * 5. Create expiration alarms
 * 6. Automatically remove expired blocks
 * 7. Allow manual block removal
 * 8. Restore missing alarms when service worker starts
 * 9. Clean up stale/expired blocks
 *
 * ==================================================
 */


/*
 * --------------------------------------------------
 * Load domain normalization utility
 * --------------------------------------------------
 */

importScripts(
    "../utils/domain.js"
);


/*
 * --------------------------------------------------
 * Constants
 * --------------------------------------------------
 */

const FIRST_RULE_ID = 1001;

const UNBLOCK_ALARM_PREFIX =
    "unblock:";


/*
 * --------------------------------------------------
 * Service worker startup log
 * --------------------------------------------------
 */

console.log(
    "FocusGuard background service worker started."
);


/*
 * ==================================================
 * STORAGE HELPERS
 * ==================================================
 */


/*
 * --------------------------------------------------
 * Get next available DNR rule ID
 * --------------------------------------------------
 */

async function getNextRuleId() {

    const result =
        await chrome.storage.local.get(
            ["nextRuleId"]
        );


    const nextRuleId =
        result.nextRuleId ||
        FIRST_RULE_ID;


    await chrome.storage.local.set({

        nextRuleId:
            nextRuleId + 1

    });


    return nextRuleId;
}


/*
 * --------------------------------------------------
 * Get all blocked websites
 * --------------------------------------------------
 */

async function getBlockedSites() {

    const result =
        await chrome.storage.local.get(
            ["blockedSites"]
        );


    return result.blockedSites || [];
}


/*
 * --------------------------------------------------
 * Save all blocked websites
 * --------------------------------------------------
 */

async function saveBlockedSites(
    blockedSites
) {

    await chrome.storage.local.set({

        blockedSites:
            blockedSites

    });

}


/*
 * ==================================================
 * ALARM HELPERS
 * ==================================================
 */


/*
 * --------------------------------------------------
 * Get alarm name for a domain
 * --------------------------------------------------
 */

function getUnblockAlarmName(
    domain
) {

    return (
        UNBLOCK_ALARM_PREFIX +
        domain
    );

}


/*
 * --------------------------------------------------
 * Create / replace unblock alarm
 * --------------------------------------------------
 *
 * Important:
 *
 * Chrome alarms with the same name replace
 * the previous alarm with that name.
 *
 * This is useful when the user updates the
 * duration of an already-blocked website.
 * --------------------------------------------------
 */

async function createUnblockAlarm(
    domain,
    expiresAt
) {

    const alarmName =
        getUnblockAlarmName(
            domain
        );


    /*
     * Do not create an alarm for
     * an already-expired timestamp.
     */

    if (
        expiresAt <= Date.now()
    ) {

        console.log(
            "Skipping expired alarm:",
            alarmName
        );

        return;

    }


    await chrome.alarms.create(
        alarmName,
        {
            when: expiresAt
        }
    );


    console.log(
        "Unblock alarm created:",
        alarmName
    );


    console.log(
        "Scheduled for:",
        new Date(expiresAt)
    );

}


/*
 * ==================================================
 * DNR HELPERS
 * ==================================================
 */


/*
 * --------------------------------------------------
 * Build FocusGuard blocked-page URL
 * --------------------------------------------------
 */

function buildBlockedPageUrl(
    domain,
    expiresAt
) {

    const params =
        new URLSearchParams({

            domain:
                domain,

            expiresAt:
                String(expiresAt)

        });


    return chrome.runtime.getURL(

        `blocked/blocked.html?${params.toString()}`

    );

}


/*
 * --------------------------------------------------
 * Create redirect rule
 * --------------------------------------------------
 */

function createRedirectRule(
    ruleId,
    domain,
    expiresAt
) {

    const blockedPageUrl =
        buildBlockedPageUrl(
            domain,
            expiresAt
        );


    return {

        id:
            ruleId,

        priority:
            1,

        action: {

            type:
                "redirect",

            redirect: {

                url:
                    blockedPageUrl

            }

        },

        condition: {

            /*
             * Domain-oriented URL filter.
             *
             * Example:
             *
             * ||youtube.com
             *
             * This matches the intended
             * website/domain family.
             */

            urlFilter:
                `||${domain}`,

            resourceTypes: [

                "main_frame"

            ]

        }

    };

}


/*
 * --------------------------------------------------
 * Get currently installed dynamic rules
 * --------------------------------------------------
 */

async function getDynamicRules() {

    return (
        await chrome
            .declarativeNetRequest
            .getDynamicRules()
    );

}


/*
 * --------------------------------------------------
 * Check whether a rule currently exists
 * --------------------------------------------------
 */

async function ruleExists(
    ruleId
) {

    const rules =
        await getDynamicRules();


    return rules.some(
        (rule) =>
            rule.id === ruleId
    );

}


/*
 * --------------------------------------------------
 * Remove DNR rule safely
 * --------------------------------------------------
 *
 * We first check whether the rule exists.
 *
 * This prevents errors if storage contains
 * a rule ID that Chrome no longer has.
 * --------------------------------------------------
 */

async function removeRuleSafely(
    ruleId
) {

    const exists =
        await ruleExists(
            ruleId
        );


    if (!exists) {

        console.log(
            "Rule already absent:",
            ruleId
        );

        return;

    }


    await chrome
        .declarativeNetRequest
        .updateDynamicRules({

            removeRuleIds: [

                ruleId

            ]

        });


    console.log(
        "DNR rule removed:",
        ruleId
    );

}


/*
 * ==================================================
 * WEBSITE BLOCKING
 * ==================================================
 */


/*
 * --------------------------------------------------
 * Handle website blocking
 * --------------------------------------------------
 */

async function handleBlockWebsite(
    message
) {

    /*
     * Normalize and validate domain.
     */

    let domain;


    try {

        domain =
            normalizeDomain(
                message.domain
            );

    } catch (error) {

        return {

            success:
                false,

            message:
                error.message

        };

    }


    /*
     * Convert duration to number.
     */

    const duration =
        Number(
            message.duration
        );


    /*
     * Validate duration.
     */

    if (
        !Number.isFinite(duration) ||
        duration <= 0
    ) {

        return {

            success:
                false,

            message:
                "Duration must be greater than zero."

        };

    }


    /*
     * Get existing blocked sites.
     */

    const blockedSites =
        await getBlockedSites();


    /*
     * Check whether this domain
     * already exists.
     */

    const existingSiteIndex =
        blockedSites.findIndex(

            (site) =>
                site.domain === domain

        );


    /*
     * ==================================================
     * EXISTING WEBSITE
     * ==================================================
     */

    if (
        existingSiteIndex !== -1
    ) {

        const existingSite =
            blockedSites[
                existingSiteIndex
            ];


        const currentTime =
            Date.now();


        const expiresAt =
            currentTime +
            duration * 60 * 1000;


        /*
         * Create updated redirect rule.
         */

        const updatedRule =
            createRedirectRule(

                existingSite.ruleId,

                domain,

                expiresAt

            );


        /*
         * Replace the existing rule.
         *
         * Same rule ID.
         *
         * Old rule removed.
         * New rule added.
         */

        await chrome
            .declarativeNetRequest
            .updateDynamicRules({

                removeRuleIds: [

                    existingSite.ruleId

                ],

                addRules: [

                    updatedRule

                ]

            });


        /*
         * Update expiration in storage.
         */

        existingSite.expiresAt =
            expiresAt;


        await saveBlockedSites(
            blockedSites
        );


        /*
         * Replace/update alarm.
         */

        await createUnblockAlarm(

            domain,

            expiresAt

        );


        console.log(
            "Existing website updated:",
            domain
        );


        console.log(
            "Rule ID:",
            existingSite.ruleId
        );


        console.log(
            "New expiration:",
            new Date(expiresAt)
        );


        return {

            success:
                true,

            message:
                `${domain} block time updated.`

        };

    }


    /*
     * ==================================================
     * NEW WEBSITE
     * ==================================================
     */


    /*
     * Generate unique rule ID.
     */

    const ruleId =
        await getNextRuleId();


    /*
     * Calculate expiration.
     */

    const currentTime =
        Date.now();


    const expiresAt =
        currentTime +
        duration * 60 * 1000;


    /*
     * Create redirect rule.
     */

    const rule =
        createRedirectRule(

            ruleId,

            domain,

            expiresAt

        );


    /*
     * Add DNR rule.
     */

    await chrome
        .declarativeNetRequest
        .updateDynamicRules({

            addRules: [

                rule

            ]

        });


    /*
     * Store website information.
     */

    blockedSites.push({

        domain:
            domain,

        expiresAt:
            expiresAt,

        ruleId:
            ruleId

    });


    await saveBlockedSites(
        blockedSites
    );


    /*
     * Create expiration alarm.
     */

    await createUnblockAlarm(

        domain,

        expiresAt

    );


    console.log(
        "Website blocked:",
        domain
    );


    console.log(
        "Rule ID:",
        ruleId
    );


    console.log(
        "Expires at:",
        new Date(expiresAt)
    );


    console.log(
        "Blocked page:",
        buildBlockedPageUrl(
            domain,
            expiresAt
        )
    );


    return {

        success:
            true,

        message:
            `${domain} is now blocked.`

    };

}


/*
 * ==================================================
 * MANUAL BLOCK REMOVAL
 * ==================================================
 */


/*
 * --------------------------------------------------
 * Handle manual block removal
 * --------------------------------------------------
 */

async function handleRemoveBlock(
    domain
) {

    /*
     * Normalize domain again.
     */

    let normalizedDomain;


    try {

        normalizedDomain =
            normalizeDomain(
                domain
            );

    } catch (error) {

        return {

            success:
                false,

            message:
                error.message

        };

    }


    /*
     * Get current blocks.
     */

    const blockedSites =
        await getBlockedSites();


    /*
     * Find website.
     */

    const siteIndex =
        blockedSites.findIndex(

            (site) =>
                site.domain ===
                normalizedDomain

        );


    /*
     * Website not found.
     */

    if (
        siteIndex === -1
    ) {

        return {

            success:
                false,

            message:
                `${normalizedDomain} is not currently blocked.`

        };

    }


    /*
     * Get website information.
     */

    const site =
        blockedSites[
            siteIndex
        ];


    /*
     * Remove DNR rule safely.
     */

    await removeRuleSafely(
        site.ruleId
    );


    /*
     * Clear expiration alarm.
     */

    await chrome.alarms.clear(

        getUnblockAlarmName(
            normalizedDomain
        )

    );


    /*
     * Remove from storage.
     */

    blockedSites.splice(
        siteIndex,
        1
    );


    await saveBlockedSites(
        blockedSites
    );


    console.log(
        "Block manually removed:",
        normalizedDomain
    );


    return {

        success:
            true,

        message:
            `${normalizedDomain} block removed.`

    };

}


/*
 * ==================================================
 * EXPIRED BLOCK CLEANUP
 * ==================================================
 */


/*
 * --------------------------------------------------
 * Clean up expired blocks
 * --------------------------------------------------
 *
 * This is a safety mechanism.
 *
 * Normally the alarm handles expiration.
 * But if an alarm is missing, this function
 * can detect expired storage entries and
 * remove their DNR rules.
 * --------------------------------------------------
 */

async function cleanupExpiredBlocks() {

    const blockedSites =
        await getBlockedSites();


    const now =
        Date.now();


    const expiredSites =
        blockedSites.filter(

            (site) =>
                site.expiresAt <= now

        );


    /*
     * Nothing to clean.
     */

    if (
        expiredSites.length === 0
    ) {

        return;

    }


    console.log(
        "Expired blocks found:",
        expiredSites
    );


    /*
     * Remove expired DNR rules.
     */

    for (
        const site
        of expiredSites
    ) {

        await removeRuleSafely(
            site.ruleId
        );

    }


    /*
     * Remove expired websites
     * from storage.
     */

    const activeSites =
        blockedSites.filter(

            (site) =>
                site.expiresAt > now

        );


    await saveBlockedSites(
        activeSites
    );


    /*
     * Clear expired alarms.
     */

    for (
        const site
        of expiredSites
    ) {

        await chrome.alarms.clear(

            getUnblockAlarmName(
                site.domain
            )

        );

    }


    console.log(
        "Expired blocks cleaned up."
    );

}


/*
 * ==================================================
 * ALARM RESTORATION
 * ==================================================
 */


/*
 * --------------------------------------------------
 * Restore missing alarms
 * --------------------------------------------------
 *
 * Dynamic DNR rules are persistent.
 *
 * Alarms can have different persistence
 * behavior depending on Chrome version.
 *
 * Therefore we verify/recreate alarms
 * whenever the service worker starts.
 * --------------------------------------------------
 */

async function restoreAlarms() {

    const blockedSites =
        await getBlockedSites();


    const now =
        Date.now();


    for (
        const site
        of blockedSites
    ) {

        /*
         * Skip already expired blocks.
         */

        if (
            site.expiresAt <= now
        ) {

            continue;

        }


        const alarmName =
            getUnblockAlarmName(
                site.domain
            );


        /*
         * Check whether alarm already exists.
         */

        const existingAlarm =
            await chrome.alarms.get(
                alarmName
            );


        /*
         * Only create if missing.
         */

        if (
            !existingAlarm
        ) {

            await createUnblockAlarm(

                site.domain,

                site.expiresAt

            );

        }

    }


    console.log(
        "Active block alarms verified/restored."
    );

}


/*
 * ==================================================
 * MESSAGE HANDLER
 * ==================================================
 */


/*
 * --------------------------------------------------
 * Listen for popup messages
 * --------------------------------------------------
 */

chrome.runtime.onMessage.addListener(

    (
        message,
        sender,
        sendResponse
    ) => {

        console.log(
            "Message received:",
            message
        );


        /*
         * ------------------------------------------
         * BLOCK WEBSITE
         * ------------------------------------------
         */

        if (
            message.type ===
            "BLOCK_WEBSITE"
        ) {

            handleBlockWebsite(
                message
            )

                .then(
                    (response) => {

                        sendResponse(
                            response
                        );

                    }
                )

                .catch(
                    (error) => {

                        console.error(
                            "Blocking error:",
                            error
                        );


                        sendResponse({

                            success:
                                false,

                            message:
                                "Something went wrong while blocking the website."

                        });

                    }
                );


            /*
             * Keep message channel open
             * for async response.
             */

            return true;

        }


        /*
         * ------------------------------------------
         * REMOVE BLOCK
         * ------------------------------------------
         */

        if (
            message.type ===
            "REMOVE_BLOCK"
        ) {

            handleRemoveBlock(
                message.domain
            )

                .then(
                    (response) => {

                        sendResponse(
                            response
                        );

                    }
                )

                .catch(
                    (error) => {

                        console.error(
                            "Remove block error:",
                            error
                        );


                        sendResponse({

                            success:
                                false,

                            message:
                                "Failed to remove block."

                        });

                    }
                );


            /*
             * Keep message channel open
             * for async response.
             */

            return true;

        }

    }

);


/*
 * ==================================================
 * ALARM EVENT
 * ==================================================
 */


/*
 * --------------------------------------------------
 * Handle expiration alarms
 * --------------------------------------------------
 */

chrome.alarms.onAlarm.addListener(

    async (alarm) => {

        try {

            console.log(
                "Alarm fired:",
                alarm.name
            );


            /*
             * Ignore unrelated alarms.
             */

            if (
                !alarm.name.startsWith(
                    UNBLOCK_ALARM_PREFIX
                )
            ) {

                return;

            }


            /*
             * Extract domain.
             *
             * Example:
             *
             * unblock:youtube.com
             *
             * becomes:
             *
             * youtube.com
             */

            const domain =
                alarm.name.replace(
                    UNBLOCK_ALARM_PREFIX,
                    ""
                );


            console.log(
                "Processing expiration:",
                domain
            );


            /*
             * Get current blocked sites.
             */

            const blockedSites =
                await getBlockedSites();


            /*
             * Find website.
             */

            const siteIndex =
                blockedSites.findIndex(

                    (site) =>
                        site.domain ===
                        domain

                );


            /*
             * If website no longer exists,
             * nothing to do.
             */

            if (
                siteIndex === -1
            ) {

                console.log(
                    "No active block found for alarm:",
                    domain
                );

                return;

            }


            /*
             * Get current site.
             */

            const site =
                blockedSites[
                    siteIndex
                ];


            /*
             * --------------------------------------------------
             * IMPORTANT:
             *
             * Check whether the block was
             * extended after the alarm was created.
             * --------------------------------------------------
             */

            if (
                site.expiresAt >
                Date.now()
            ) {

                console.log(
                    "Block was extended. Keeping it active:",
                    domain
                );


                /*
                 * Recreate the correct alarm
                 * in case the current alarm was
                 * an older schedule.
                 */

                await createUnblockAlarm(

                    domain,

                    site.expiresAt

                );


                return;

            }


            /*
             * The block has genuinely expired.
             */


            /*
             * Remove DNR rule safely.
             */

            await removeRuleSafely(
                site.ruleId
            );


            /*
             * Remove website from storage.
             */

            blockedSites.splice(
                siteIndex,
                1
            );


            await saveBlockedSites(
                blockedSites
            );


            /*
             * Clear the alarm.
             */

            await chrome.alarms.clear(

                getUnblockAlarmName(
                    domain
                )

            );


            console.log(
                "Website successfully unblocked:",
                domain
            );

        } catch (error) {

            console.error(
                "Alarm handling error:",
                error
            );

        }

    }

);


/*
 * ==================================================
 * SERVICE WORKER STARTUP RECOVERY
 * ==================================================
 */


/*
 * --------------------------------------------------
 * Run cleanup + alarm restoration
 * --------------------------------------------------
 *
 * We deliberately run this asynchronously
 * after the service worker has loaded.
 * --------------------------------------------------
 */

(async () => {

    try {

        /*
         * First remove expired blocks.
         */

        await cleanupExpiredBlocks();


        /*
         * Then make sure every active
         * block has an alarm.
         */

        await restoreAlarms();


        console.log(
            "FocusGuard startup recovery completed."
        );

    } catch (error) {

        console.error(
            "FocusGuard startup recovery failed:",
            error
        );

    }

})();


/*
 * --------------------------------------------------
 * Browser startup event
 * --------------------------------------------------
 *
 * This provides an additional recovery
 * point when Chrome starts.
 * --------------------------------------------------
 */

chrome.runtime.onStartup.addListener(

    async () => {

        try {

            console.log(
                "Browser started. Recovering FocusGuard..."
            );


            await cleanupExpiredBlocks();


            await restoreAlarms();


            console.log(
                "FocusGuard browser-start recovery completed."
            );

        } catch (error) {

            console.error(
                "Browser-start recovery failed:",
                error
            );

        }

    }

);