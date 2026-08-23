function normalizeDomain(input) {
  if (typeof input !== "string") {
    throw new Error("Website must be text.");
  }

  let value = input.trim().toLowerCase();

  /*
   * Remove protocol.
   */

  value = value.replace(/^https?:\/\//, "");

  /*
   * Remove leading www.
   */

  value = value.replace(/^www\./, "");

  /*
   * Remove everything after /
   */

  value = value.split("/")[0];

  /*
   * Remove everything after ?
   */

  value = value.split("?")[0];

  /*
   * Remove everything after #
   */

  value = value.split("#")[0];

  /*
   * Remove port.
   */

  value = value.split(":")[0];

  /*
   * Remove trailing dot.
   */

  value = value.replace(/\.$/, "");

  /*
   * Basic domain validation.
   */

  const domainPattern =
    /^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/;

  if (!domainPattern.test(value)) {
    throw new Error("Please enter a valid domain such as youtube.com.");
  }

  return value;
}
