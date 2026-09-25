import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isServerOfficeWorkOrdersEnabled,
  SERVER_OFFICE_WORK_ORDER_LIST_LIMIT,
} from "./server-office-read";

describe("server office work-order read", () => {
  it("keeps the office migration flag disabled unless explicitly set", () => {
    const previous = process.env.MATRIX_SERVER_OFFICE_WORK_ORDERS;
    try {
      delete process.env.MATRIX_SERVER_OFFICE_WORK_ORDERS;
      assert.equal(isServerOfficeWorkOrdersEnabled(), false);
      process.env.MATRIX_SERVER_OFFICE_WORK_ORDERS = "true";
      assert.equal(isServerOfficeWorkOrdersEnabled(), true);
    } finally {
      if (previous === undefined) delete process.env.MATRIX_SERVER_OFFICE_WORK_ORDERS;
      else process.env.MATRIX_SERVER_OFFICE_WORK_ORDERS = previous;
    }
  });

  it("caps list reads for manager validation endpoints", () => {
    assert.equal(SERVER_OFFICE_WORK_ORDER_LIST_LIMIT, 500);
  });
});
