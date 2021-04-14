import { Endpoint } from "./Endpoint";

export class MessageEndpoint extends Endpoint {
  name = "message";

  _clientHandler(response: any) {
    console.log(`Response: ${response}`);
    return response;
  }

  _serverHandler(request: any) {
    const data = request.data;
    return data;
  }

  fire = async (data: string): Promise<string> => {
    const transactionInstance = this.newTransaction();
    const transactionData = transactionInstance.serialize(data);
    this.clientEmmit(Buffer.from(transactionData));
    return await transactionInstance.promiseInstance;
  };
}
