import { ClientService } from "./ClientService";

const service = new ClientService();
service.clientConnect().then(async () => {
  await service
    .run("Ping", "Hey")
    .then((e) => {
      console.log(e);
    })
    .catch(console.error)
    .finally(() => {
      service.disconnect();
    });
});
