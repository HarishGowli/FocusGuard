/*
 * --------------------------------------------------
 * Schedule utilities
 * --------------------------------------------------
 */

/*
 * Valid day numbers
 *
 * 0 = Sunday
 * 1 = Monday
 * 2 = Tuesday
 * 3 = Wednesday
 * 4 = Thursday
 * 5 = Friday
 * 6 = Saturday
 */

const VALID_DAYS = [0, 1, 2, 3, 4, 5, 6];

/*
 * --------------------------------------------------
 * Validate HH:MM time
 * --------------------------------------------------
 */

function isValidTime(time) {
  if (typeof time !== "string") {
    return false;
  }

  const match = time.match(/^([01]\d|2[0-3]):([0-5]\d)$/);

  return Boolean(match);
}

/*
 * --------------------------------------------------
 * Validate schedule
 * --------------------------------------------------
 */

function validateSchedule(schedule) {
  if (!schedule || typeof schedule !== "object") {
    return {
      valid: false,

      message: "Schedule is required.",
    };
  }

  /*
   * Validate days
   */

  if (!Array.isArray(schedule.days)) {
    return {
      valid: false,

      message: "Schedule days must be an array.",
    };
  }

  if (schedule.days.length === 0) {
    return {
      valid: false,

      message: "Select at least one day.",
    };
  }

  const invalidDay = schedule.days.some((day) => !VALID_DAYS.includes(day));

  if (invalidDay) {
    return {
      valid: false,

      message: "Schedule contains an invalid day.",
    };
  }

  /*
   * Validate start time
   */

  if (!isValidTime(schedule.startTime)) {
    return {
      valid: false,

      message: "Invalid start time.",
    };
  }

  /*
   * Validate end time
   */

  if (!isValidTime(schedule.endTime)) {
    return {
      valid: false,

      message: "Invalid end time.",
    };
  }

  /*
   * Start and end cannot be equal.
   */

  if (schedule.startTime === schedule.endTime) {
    return {
      valid: false,

      message: "Start and end time cannot be the same.",
    };
  }

  return {
    valid: true,

    message: "Schedule is valid.",
  };
}
