import { ConflictException, InternalServerErrorException, NotFoundException } from "@nestjs/common";
import { EntityRepository, Repository } from "typeorm";
import * as bcrypt from 'bcrypt';
import { AuthCredentials } from "./dto/auth-credentilas.dto";
import { User } from "./user.entity";
import { randomBytes } from 'crypto';
import { privateKeyVerify } from 'secp256k1';
import * as Likelib from "../../likelib-js/likelib.js"

@EntityRepository(User)
export class UserRepository extends Repository<User>{


    async signUp(authCredentialsDto: AuthCredentials): Promise<void> {

        const { username, password, balance } = authCredentialsDto;

        let privateKeyHex: string = '';
        let privateKeyBuf: Buffer = randomBytes(32);
        while (!privateKeyVerify(privateKeyBuf)) {
            privateKeyBuf = randomBytes(32);
        };
        privateKeyHex = privateKeyBuf.toString('hex')

        const user = new User();
        user.username = username;
        user.balance = balance;
        user.salt = await bcrypt.genSalt();
        user.password = await this.hashPassword(password, user.salt);
        user.privateKey = privateKeyHex;

        console.log(user.privateKey);

        try {
            await user.save()
        } catch (error) {

            if (error.code === '23505') {//duplicate username
                throw new ConflictException('Username alreday exists');
            }
            else {
                console.log(error);
                console.log(error.stack);

                throw new InternalServerErrorException("User don't save");
            }
        }
        let account = new Likelib.Account("2aef91bc6d2df7c41bd605caa267e8d357e18b741c4a785e06650d649d650409");
        let lk = new Likelib("ws://node.eacsclover.ml");

        const userPrivKey = user.privateKey;
        const recipient = new Likelib.Account(userPrivKey);

        const tx = new Likelib.Tx({
            from: account.getAddress(),
            to: recipient.getAddress(),
            amount: 10**8,
            fee: 10000,
            data: "".toString()
        });

        account.sign(tx);

        const accountTrasaction: any = () => {
            return new Promise((res, rej) => {
                lk.pushTransaction(tx, function (err, reply) {
                    if (err) {
                        console.log(err);
                        rej(err)
                    }
                    else if (reply.status_code == Likelib.Tx.Status.Pending) {
                        return;
                    }
                    else if (reply.status_code != Likelib.Tx.Status.Success) {
                        console.log(reply);
                        console.log("Transfer failed with status code " + reply.status_code);
                    }
                    else {
                        res(reply.fee_left)
                        console.log("Fee left ", reply.fee_left);
                    }
                })
            }
            );
        };
        await accountTrasaction();
    }


    public async getUserById(id: number): Promise<User> {

        const found = await this.findOne(id);

        if (!found) {
            throw new NotFoundException(`User with ${id} not found `);
        }

        return found;

    }

    async validateUserPassword(authCredentialsDto: AuthCredentials): Promise<string> {

        const { username, password } = authCredentialsDto;
        const user = await this.findOne({ username })

        if (user && await user.validatePassword(password)) {
            return user.username;
        } else {
            return null;
        }
    }

    private async hashPassword(password: string, salt: string): Promise<string> {
        return bcrypt.hash(password, salt);
    }
}