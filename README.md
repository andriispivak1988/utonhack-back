# Clover-eac
​
#### Requirements
- node 14
- postgres 12
- pm2
​
Before run backend you need:
​
change clover node address in three place from ```ws://node.eacsclover.ml``` to your ```DNS name or IP:PORT```
​
- ./src/auth/user.repository.ts:49
- ./src/eacs/eacs.service.ts:152
- ./src/eacs/eacs.service.ts:264
​
create DB with name ```clovereacs``` and user/password ```postgres/postgres```
​
#### Run commands
##### Install dependency
```npm install```
​
##### For run in prod mode 
```npm run build```
​
```cd dist```
​
```pm2 start --name api --time main.js```
​
##### For run in dev mode
```npm run start:debug```
​
##### API will be available on port 3030
​
​
