import { BybitService } from "../bybitService";

describe("BybitService", () => {
  it("rejects missing API credentials during initialization", async () => {
    const service = new BybitService();

    await expect(service.initialize({ apiKey: "", apiSecret: "" }, "spot")).rejects.toThrow(
      "Missing Bybit API credentials",
    );
  });
});
