import { Injectable, InternalServerErrorException, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from 'src/auth/user.entity';
import { UserRepository } from 'src/auth/user.repository';
import { EACs } from './dto/eacs.entity';
import { AskRepository, EACsRepository } from './eacs.repository';
import * as Likelib from "../../likelib-js/likelib.js"
import { IsAskDto } from './dto/isAsk.dto';
import { Ask } from './dto/ask.entity';
import { BindsType } from './dto/bindsType.dto';
import { CreateEACsDto } from './dto/create-eacs.dto';
import { StationService } from 'src/station/station.service';
const NFTArtifact = require("../../truffle/build/contracts/NFT.json");
@Injectable()
export class EACsService {
​
    private logger = new Logger('EACsService');
​
    constructor(@InjectRepository(EACsRepository)
    private eacsRepository: EACsRepository,
        @InjectRepository(AskRepository)
        private askRepository: AskRepository,
        @InjectRepository(UserRepository)
        private userRepository: UserRepository,
        private stationService: StationService) { }
​
    public async getAllEACs(user: User): Promise<EACs[]> {
​
​
        const query = this.eacsRepository.createQueryBuilder('eacs');
        query.where('eacs.userId = :userId', { userId: user.id })
​
        const eacs = await query.orderBy('eacs.id').getMany();
​
        return eacs;
    }
​
​
    public async getAllAskEACs(user: User): Promise<EACs[]> {
​
        const query = this.eacsRepository.createQueryBuilder('eacs');
        query.where('eacs.userId != :userId AND eacs.isAsk  = :isAsk AND eacs.isArchive  = :isArchive', { userId: user.id, isAsk: true, isArchive: false })
​
        const eacs = await query.orderBy('eacs.id').getMany();
​
        return eacs;
    }
​
    public async getEACsById(id: number, user: User): Promise<EACs> {
​
        const found = await this.eacsRepository.findOne({ where: { id, userId: user.id } });
​
        if (!found) {
            throw new NotFoundException(`EACs with ${id} and user ${user.id}  not found `);
        }
​
        return found;
​
    }
​
    public async getBindEACsById(id: number, user: User): Promise<Ask[]> {
​
        const query = this.askRepository.createQueryBuilder('ask');
        query.where('ask.eacsId = :eacsId', { eacsId: id })
​
        const ask = await query.orderBy('ask.price', "DESC").getMany();
​
        return ask;
​
    }
​
​
    public async getAskByEACsUserId(eacsId: number, userId: number): Promise<Ask> {
​
        const found = await this.askRepository.findOne({ where: { eacsId: eacsId, userId: userId } });
​
        return found;
​
    }
​
    public async bindAskEACs(bindsType: BindsType, user: User): Promise<Ask> {
​
        const ask = await this.getAskByEACsUserId(bindsType.eacsId, user.id);
​
​
        if (ask) {
​
            ask.eacsId = bindsType.eacsId;
            ask.userId = user.id;
            ask.price = bindsType.price;
            ask.userName = user.username;
            await ask.save();
        }
​
        else {
​
            let ask = this.askRepository.create({ eacsId: bindsType.eacsId, userId: user.id, userName: user.username, price: bindsType.price });
            await ask.save();
        }
​
        return ask;
​
    }
​
​
​
    public async updateEACsAsk(id: number, isAskDto: IsAskDto, user: User): Promise<EACs> {
​
        const updatedEACs = await this.getEACsById(id, user);
​
        updatedEACs.isAsk = isAskDto?.isAsk;
        updatedEACs.price = isAskDto?.price;
​
        try {
​
            await updatedEACs.save();
​
​
        } catch (error) {
            this.logger.error(`Failed to update  isAsk and price`, error.stack)
            throw new InternalServerErrorException();
        }
​
​
        return updatedEACs;
    }
​
    public async createEACs(eacsInput: CreateEACsDto, user: User): Promise<EACs> {
​
​
        let eacs = this.eacsRepository.create(eacsInput);
        eacs.user = user;
        if (!eacsInput.stationId) {
​
            const currentStation = (await this.stationService.getAllStations(user))[0];
​
​
            if (currentStation) {
                eacs.station = currentStation;
            }
            else {
                throw new InternalServerErrorException("created eacs must be have station");
            }
​
​
        }
        else {
            eacs.station = await this.stationService.getStationById(eacsInput.stationId, user);
        }
​
        let account = new Likelib.Account("2aef91bc6d2df7c41bd605caa267e8d357e18b741c4a785e06650d649d650409");
        let lk = new Likelib("ws://node.eacsclover.ml");
​
        const userPrivKey = user.privateKey;
        const recipient = new Likelib.Account(userPrivKey);
        
​		eacs.fromAddress = account.getAddress();
 		eacs.toAddress = recipient.getAddress();

        const abi = NFTArtifact.abi;
        const compiled = NFTArtifact.bytecode.slice(2);
​
        let contract = Likelib.Contract.nondeployed(lk, recipient, abi, compiled);
​
        const contractDeploy: any = () => {
            return new Promise((res, rej) => {
                contract.deploy(eacsInput.energyAmount, new Date(eacsInput.creationEnergyStartDate).getTime(), new Date(eacsInput.creationEnergyEndDate).getTime(), eacsInput.stationId ,'0xE1fF88112A470C383e680ba1492f59E6D4BE4C2e', 0, 1000000, function (err, fee_left ) {
                    if (err) {
                        console.log("Error during deployment: " + err);
                        rej(err)
                    }
​
                    else {
                        res(contract._address)
                        console.log("Contract was successfully deployed fee_left: " + fee_left);
                        console.log("Contract address: " + contract._address + " Set it address in contract call");
                        eacs.contractAddress =contract._address;
                    }
                });
            });
        };
        await contractDeploy();
        await eacs.save();
        return eacs;
​
    }
​
    private _sleep(time: number) {
        let delay = time;
        delay += new Date().getTime();
        while (new Date().getTime() < delay){}
	console.log('sleep');
    }
​
    public async deleteEACs(id: number, user: User): Promise<void> {
​
        const result = await this.eacsRepository.delete({ id, userId: user.id });
​
        if (result.affected === 0) {
            throw new NotFoundException(`EACs with ID "${id}" not found`)
        }
​
    }
​
    public async createAsk(askInput: Ask): Promise<Ask> {
​
        let ask = this.askRepository.create(askInput);
​
        try {
​
            await ask.save();
​
        } catch (error) {
​
            this.logger.error(`Failed to create a ask`, error.stack)
            throw new InternalServerErrorException();
​
        }
​
        return ask;
​
    }
​
    public async getAskById(id: number): Promise<Ask> {
​
        const found = await this.askRepository.findOne(id);
​
        if (!found) {
            throw new NotFoundException(`Ask with ${id}   not found `);
        }
​
        return found;
​
    }
​
    public async confirmAskEACs(id: number, user: User): Promise<EACs> {
​
​
        const updatedBids = await this.getAskById(id);
​
        const updatedEACs = await this.getEACsById(updatedBids.eacsId, user);
        updatedEACs.isArchive = true;
	    updatedEACs.userId = updatedBids.userId;
        try {
​
            await updatedEACs.save();
​
        } catch (error) {
            this.logger.error(`Failed to update  Ask  archive`, error.stack)
            throw new InternalServerErrorException();
        }
​
        try {
​
            const query = this.askRepository.createQueryBuilder('ask');
            await query.update()
                .set({ isArchive: true })
                .where(`eacsId = :eacsId`, { eacsId: updatedBids.eacsId })
                .execute();
​
        } catch (error) {
            this.logger.error(`Failed to update  Ask  archive`, error.stack)
            throw new InternalServerErrorException();
        }
​
        let account = new Likelib.Account("2aef91bc6d2df7c41bd605caa267e8d357e18b741c4a785e06650d649d650409");
        let lk = new Likelib("ws://node.eacsclover.ml");
        const abi = NFTArtifact.abi;
        const contract_address = updatedEACs.contractAddress;
        let contract = Likelib.Contract.deployed(lk, account, abi, contract_address);
        contract._setupMethods(abi);
        const newOwnerUser = await this.userRepository.getUserById(updatedBids.userId);
        const newOwnerPrivKey = newOwnerUser.privateKey;
        const recipient = new Likelib.Account(newOwnerPrivKey);
        const callContractMethod: any = () => {
            return new Promise((res, rej) => {
                contract.transferOwnership(recipient._addressHex, 0, 1000000, function (err, result) {
                    if (err) {
                        console.log("Error change owner: " + err);
                        rej(err)
                    }
​
                    else {
                        res(result)
                        console.log(result);
                    }
                });
            });
        };
        await callContractMethod();
​
        return updatedEACs;
    }
}
