import { Endpoint } from "./Endpoint";

export class PingEndpoint extends Endpoint {
  public name = "Ping";

  protected _clientHandler(response: any) {
    console.log(`Response: ${response}`);
    return response;
  }

  protected _serverHandler(payload: any) {
    return payload;
  }

  public fire = async (data: string): Promise<string> => {
    const transactionInstance = this.newTransaction();
    const transactionData = transactionInstance.serialize(data);
    this.clientEmmit(Buffer.from(transactionData));
    return await transactionInstance.promiseInstance;
  };
}
