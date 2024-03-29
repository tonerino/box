import { Injectable } from '@angular/core';
import * as mvtkReserve from '@motionpicture/mvtk-reserve-service';
import { factory } from '@toei-jp/cinerino-api-javascript-client';
import * as moment from 'moment';
// import { ISeat } from '../../components/parts/screen/screen.component';
import { environment } from '../../../environments/environment';
import { TimeFormatPipe } from '../../pipes/time-format/time-format.pipe';
// import { AwsCognitoService } from '../aws-cognito/aws-cognito.service';
// import { CallNativeService } from '../call-native/call-native.service';
import { CinerinoService } from '../cinerino/cinerino.service';
import { IConfig, SaveType, StorageService } from '../storage/storage.service';
// import { UserService } from '../user/user.service';

declare const ga: Function;

export type IScreeningEvent = factory.chevre.event.screeningEvent.IEvent;
export type ICustomerContact = factory.transaction.placeOrder.ICustomerContact;
export type ISalesTicketResult = factory.chevre.ticketType.ITicketType;
export import BoxPaymentMethod = factory.boxPaymentMethodType;
// type IUnauthorizedCardOfMember = factory.paymentMethod.paymentCard.creditCard.IUnauthorizedCardOfMember;
// type IUncheckedCardTokenized = factory.paymentMethod.paymentCard.creditCard.IUncheckedCardTokenized;

export interface IOffer {
    price: number;
    priceCurrency: string;
    seatNumber: string;
    seatSection: string;
    selected: boolean;
    // limitCount: number;
    // limitUnit: string;
    validation: boolean;
    ticketInfo: {
        mvtkNum: string;
        // ticketCode: string;
        ticketId: string,
        ticketName: { en: string, ja: string };
        description: { en: string, ja: string };
        charge: number,
        mvtkAppPrice: number;
        // addGlasses: number;
        kbnEisyahousiki: string;
        mvtkKbnDenshiken: string;
        mvtkKbnMaeuriken: string;
        mvtkKbnKensyu: string;
        mvtkSalesPrice: number;
        // addPrice: number,
        // disPrice: number,
        // salePrice: number,
        seatNum: string;
        // stdPrice: number,
        ticketCount: number,
        // ticketNameEng: string;
        // ticketNameKana: string;
        // usePoint?: number;
    };
}

interface IData {
    /**
     * 取引
     */
    transaction?: factory.transaction.placeOrder.ITransaction;
    /**
     * 上映イベント
     */
    screeningEvent?: IScreeningEvent;
    /**
     * 劇場ショップ
     */
    movieTheaterOrganization?: factory.organization.movieTheater.IOrganization;
    /**
     * 販売可能チケット情報
     */
    salesTickets: ISalesTicketResult[];
    /**
     * 予約座席
     */
    seatReservationAuthorization?: factory.action.authorize.offer.seatReservation.IAction;
    /**
     * 予約座席パラメタ
     */
    reservationAuthorizationArgs?: factory.chevre.transaction.reserve.IObjectWithoutDetail & {
        /**
         * 取引ID
         */
        transactionId: string;
    };
    offers: IOffer[];
    /**
     * オーダー回数
     */
    orderCount: number;
    /**
     * GMOトークンオブジェクト
     */
    gmoTokenObject?: IGmoTokenObject;
    /**
     * 支払いクレジットカード
     */
    // paymentCreditCard?: IUnauthorizedCardOfMember | IUncheckedCardTokenized;
    /**
     * クレジットカードエラー
     */
    isCreditCardError: boolean;
    /**
     * 決済情報（クレジット）
     */
    boxAuthorization?: {
        id: string;
    };
    /**
     * 購入者情報
     */
    customerContact?: ICustomerContact;
    /**
     * ムビチケ券種情報
     */
    mvtkTickets: IMvtkTicket[];
    /**
     * ムビチケ使用情報
     */
    // mvtkAuthorization?: {
    //     id: string;
    // };
    /**
     * インセンティブ情報
     */
    // pecorinoAwardAuthorization?: {
    //     id: string;
    // };
    /**
     * インセンティブ
     */
    // incentive: number;
    /**
     * ポイント券種情報
     */
    // pointTickets: factory.chevre.services.master.ITicketResult[];
    /**
     * お支払い=現金の場合
     */
    cash?: { receive: number; return: number };
}

export interface IGmoTokenObject {
    token: string;
    toBeExpiredAt: string;
    maskedCardNo: string;
    isSecurityCodeSet: boolean;
}

export interface IMvtkTicket {
    mvtkTicketcodeResult: { code: string; name: string };
    knyknrNoInfo: mvtkReserve.services.auth.purchaseNumberAuth.IPurchaseNumberInfo;
    ykknInfo: mvtkReserve.services.auth.purchaseNumberAuth.IValidTicket;
    input?: {
        knyknrNo: string;
        pinCd: string;
    };
}

/**
 * インセンティブ
 */
/*enum Incentive {
    WatchingMovies = 1
}*/

@Injectable()
export class PurchaseService {

    public data: IData;

    constructor(
        private storage: StorageService,
        private cinerino: CinerinoService,
        // private awsCognito: AwsCognitoService,
        // private callNative: CallNativeService,
        // private user: UserService
    ) {
        this.load();
    }

    /**
     * 読み込み
     * @method load
     */
    public load() {
        const data: IData | null = this.storage.load('purchase', SaveType.Session);
        if (data === null) {
            this.data = {
                salesTickets: [],
                mvtkTickets: [],
                // pointTickets: [],
                orderCount: 0,
                // incentive: 0,
                isCreditCardError: false,
                offers: []
            };

            return;
        }
        this.data = data;
    }

    /**
     * 保存
     * @method save
     */
    public save() {
        this.storage.save('purchase', this.data, SaveType.Session);
    }

    /**
     * リセット
     * @method reset
     */
    public reset() {
        this.data = {
            salesTickets: [],
            mvtkTickets: [],
            // pointTickets: [],
            orderCount: 0,
            // incentive: 0,
            isCreditCardError: false,
            offers: []
        };
        this.save();
    }

    /**
     * 期限切れ
     * @method isExpired
     */
    public isExpired() {
        if (this.data.transaction === undefined) {
            throw new Error('status is different');
        }
        const expires = moment(this.data.transaction.expires).unix();
        const now = moment().unix();
        let result = false;
        if (expires < now) {
            result = true;
        }

        return result;
    }

    /**
     * 販売可能時間判定
     * @method isSalesTime
     * @param {IScreeningEvent} screeningEvent
     * @returns {boolean}
     */
    public isSalesTime(screeningEvent: IScreeningEvent): boolean {
        const END_TIME = 30; // 30分前

        return (moment().unix() < moment(screeningEvent.startDate).subtract(END_TIME, 'minutes').unix());
    }

    /**
     * 販売可能判定
     * @method isSales
     * @param {IScreeningEvent} screeningEvent
     * @returns {boolean}
     */
    public isSales(screeningEvent: IScreeningEvent): boolean {
        // const PRE_SALE = '1'; // 先行販売

        // return (moment(screeningEvent.info.rsvStartDate).unix() <= moment().unix()
        //     || screeningEvent.info.flgEarlyBooking === PRE_SALE);
        return moment(screeningEvent.releaseTime).unix() <= moment().unix();
    }

    /**
     * 劇場名取得
     * @method getTheaterName
     * @returns {string}
     */
    public getTheaterName(): string {
        if (this.data.screeningEvent === undefined) {
            return '';
        }
        const screeningEvent = this.data.screeningEvent;

        return screeningEvent.superEvent.location.name.ja;
    }

    /**
     * スクリーン名取得
     * @method getScreenName
     * @returns {string}
     */
    public getScreenName(): string {
        if (this.data.screeningEvent === undefined) {
            return '';
        }
        const screeningEvent = this.data.screeningEvent;

        return screeningEvent.location.name.ja;
    }

    /**
     * 作品名取得
     * @method getTitle
     * @returns {string}
     */
    public getTitle(): string {
        if (this.data.screeningEvent === undefined) {
            return '';
        }
        const screeningEvent = this.data.screeningEvent;

        return screeningEvent.name.ja;
    }

    /**
     * 鑑賞日取得
     * @method getAppreciationDate
     * @returns {string}
     */
    public getAppreciationDate(): string {
        if (this.data.screeningEvent === undefined) {
            return '';
        }
        const screeningEvent = this.data.screeningEvent;
        moment.locale('ja');

        return moment(screeningEvent.startDate).format('YYYY年MM月DD日(ddd)');
    }

    /**
     * 上映開始時間取得
     * @method getStartDate
     * @returns {string}
     */
    public getStartDate(): string {
        if (this.data.screeningEvent === undefined) {
            return '';
        }
        return new TimeFormatPipe().transform(this.data.screeningEvent.startDate);
    }

    /**
     * 上映終了取得
     * @method getEndDate
     * @returns {string}
     */
    public getEndDate(): string {
        if (this.data.screeningEvent === undefined) {
            return '';
        }
        return new TimeFormatPipe().transform(this.data.screeningEvent.endDate);
    }

    /**
     * 合計金額計算
     * @method getTotalPrice
     */
    public getTotalPrice(): number {
        let result = 0;
        if (this.data.seatReservationAuthorization === undefined) {
            return result;
        }
        for (const offer of this.data.offers) {
            result += offer.price;
        }

        return result;
    }

    /**
     * ムビチケ合計金額計算
     * @method getTotalPrice
     */
    public getMvtkTotalPrice(): number {
        let result = 0;
        if (this.data.seatReservationAuthorization === undefined) {
            return result;
        }
        for (const offer of this.data.offers) {
            result += offer.ticketInfo.mvtkSalesPrice;
        }

        return result;
    }

    /**
     * メンバーズの券種コード取得
     * @method getMemberTicketCode
     * @returns {string[]}
     */
    /*public getMemberTicketCode(): string[] {
        if (this.data.screeningEvent === undefined) {
            return [];
        }
        const branchCode = this.data.movieTheaterOrganization ?
        this.data.movieTheaterOrganization.location.branchCode : undefined;
        const memberTicket = environment.MEMBER_TICKET.find((data) => data.THEATER === branchCode);
        if (memberTicket === undefined) {
            return [];
        }
        return memberTicket.TICKET_CODE;
    }*/

    /**
     * ムビチケ対応作品判定
     * @method isUsedMvtk
     * @returns {boolean}
     */
    public isUsedMvtk(): boolean {
        if (this.data.screeningEvent === undefined) {
            return false;
        }

        return this.data.screeningEvent.superEvent.mvtkFlg === 1 &&
            this.data.screeningEvent.mvtkExcludeFlg !== '1';
    }

    /**
     * ポイント対応作品判定
     * @method isUsedPoint
     * @returns {boolean}
     */
    /*public isUsedPoint(): boolean {
        if (this.data.salesTickets.length === 0
            || this.data.screeningEvent === undefined) {
            return false;
        }

        const screeningEvent = this.data.screeningEvent;

        const pointInfo = environment.POINT_TICKET.find((ticket) => {
            return ticket.THEATER === screeningEvent.location.branchCode;
        });

        if (pointInfo === undefined) {
            return false;
        }

        const pointTicketCodeList = pointInfo.TICKET_CODE;

        const pointTickets = this.data.salesTickets.filter((salesTicket) => {
            const ticketCode = pointTicketCodeList.find((pointTicketcode) => {
                return pointTicketcode === salesTicket.ticketCode;
            });

            return ticketCode !== undefined;
        });

        return pointTickets.length > 0;
    }*/

    /**
     * ポイントでの予約判定
     * @method isReserveMvtk
     * @returns {boolean}
     */
    public isReserveMvtk(): boolean {
        let result = false;
        if (this.data.seatReservationAuthorization === undefined) {
            return result;
        }
        for (const offer of this.data.offers) {
            if (offer.ticketInfo.mvtkNum !== '') {
                result = true;
                break;
            }
        }
        return result;
    }

    /**
     * インセンティブ判定
     * @method isIncentive
     * @returns {boolean}
     */
    /*public isIncentive(): boolean {
        if (this.data.seatReservationAuthorization === undefined) {
            return false;
        }
        const pointTickets: factory.chevre.services.master.ITicketResult[] = [];
        for (const offer of this.data.seatReservationAuthorization.object.offers) {
            const pointTicket = this.data.pointTickets.find((ticket) => {
                return (ticket.ticketCode === offer.ticketInfo.ticketCode);
            });
            if (pointTicket !== undefined) {
                pointTickets.push(pointTicket);
            }
        }

        return (pointTickets.length !== this.data.seatReservationAuthorization.object.offers.length);
    }*/

    /**
     * ポイントでの予約判定
     * @method isReservePoint
     * @returns {boolean}
     */
    /*public isReservePoint(): boolean {
        let result = false;
        if (this.data.seatReservationAuthorization === undefined
            || this.data.pointTickets.length === 0) {
            return result;
        }
        for (const offer of this.data.seatReservationAuthorization.object.offers) {
            const pointTickets = this.data.pointTickets.filter((ticket) => {
                return (ticket.ticketCode === offer.ticketInfo.ticketCode);
            });
            if (pointTickets.length > 0) {
                result = true;
                break;
            }
        }

        return result;
    }*/

    /**
     * ムビチケ着券情報取得
     * @method getMvtkSeatInfoSync
     */
    public getMvtkSeatInfoSync(confirmationNumber: number, options?: {
        deleteFlag?: string
        reservedDeviceType?: string
    }) {
        if (this.data.seatReservationAuthorization === undefined
            || this.data.seatReservationAuthorization.result === undefined
            || this.data.screeningEvent === undefined
            || this.data.mvtkTickets === undefined) {
            throw new Error('status is different');
        }
        const mvtkPurchaseNoInfoList: mvtkReserve.services.seat.seatInfoSync.IKnyknrNoInfo[] = [];
        const mvtkseat: { zskCd: string; }[] = [];

        for (const offer of this.data.offers) {
            const mvtkTicket = this.data.mvtkTickets.find((ticket) => {
                return (ticket.knyknrNoInfo.knyknrNo === offer.ticketInfo.mvtkNum
                    && ticket.mvtkTicketcodeResult.code === offer.ticketInfo.ticketId);
            });
            if (mvtkTicket === undefined || mvtkTicket.input === undefined) {
                continue;
            }
            const mvtkPurchaseNoInfo = mvtkPurchaseNoInfoList.find((i) => {
                return (i.knyknrNo === mvtkTicket.knyknrNoInfo.knyknrNo);
            });
            if (mvtkPurchaseNoInfo !== undefined) {
                const knshInfo = mvtkPurchaseNoInfo.knshInfo.find((i) => {
                    return (i.knshTyp === mvtkTicket.ykknInfo.ykknshTyp);
                });
                if (knshInfo !== undefined) {
                    knshInfo.miNum += 1;
                } else {
                    mvtkPurchaseNoInfo.knshInfo.push({
                        knshTyp: mvtkTicket.ykknInfo.ykknshTyp,
                        miNum: 1
                    });
                }
            } else {
                mvtkPurchaseNoInfoList.push({
                    knyknrNo: mvtkTicket.knyknrNoInfo.knyknrNo,
                    pinCd: mvtkTicket.input.pinCd,
                    knshInfo: [{
                        knshTyp: mvtkTicket.ykknInfo.ykknshTyp,
                        miNum: 1
                    }]
                });
            }
            mvtkseat.push({ zskCd: offer.seatNumber });
        }
        if (mvtkPurchaseNoInfoList.length === 0 || mvtkseat.length === 0) {
            throw new Error('status is different');
        }
        const DIGITS = -2;
        const info = this.data.screeningEvent;
        const day = moment(info.doorTime).format('YYYY/MM/DD');
        const time = `${new TimeFormatPipe().transform(this.data.screeningEvent.startDate)}:00`;
        const tmpReserveNum = confirmationNumber;
        const systemReservationNumber = `${moment(info.doorTime).format('YYYYMMDD')}${confirmationNumber}`;
        const siteCode = String(Number(`00${this.data.screeningEvent.location.branchCode}`.slice(DIGITS)));
        const deleteFlag = (options === undefined || options.deleteFlag === undefined) ? '0' : options.deleteFlag;
        const reservedDeviceType = (options === undefined || options.reservedDeviceType === undefined) ? '02' : options.reservedDeviceType;
        const skhnCd = info.workPerformed.identifier;

        return {
            kgygishCd: environment.MVTK_COMPANY_CODE,
            yykDvcTyp: reservedDeviceType,
            trkshFlg: deleteFlag,
            kgygishSstmZskyykNo: systemReservationNumber,
            kgygishUsrZskyykNo: String(tmpReserveNum),
            jeiDt: `${day} ${time}`,
            kijYmd: day,
            stCd: siteCode,
            screnCd: info.location.branchCode,
            knyknrNoInfo: mvtkPurchaseNoInfoList,
            zskInfo: mvtkseat,
            skhnCd: skhnCd
        };
    }

    /**
     * 取引開始処理
     * @method transactionStartProcess
     */
    public async transactionStartProcess(args: {
        passportToken: string;
        screeningEvent: IScreeningEvent
    }) {
        // 購入データ削除
        this.reset();
        this.data.screeningEvent = args.screeningEvent;
        await this.cinerino.getServices();
        // 劇場のショップを検索
        this.data.movieTheaterOrganization = (await this.cinerino.organization.findMovieTheaterByBranchCode({
            branchCode: this.data.screeningEvent.superEvent.location.branchCode
        })).data[0];
        // 取引期限
        const VALID_TIME = 15;
        const expires = moment().add(VALID_TIME, 'minutes').toDate();
        // 取引開始
        this.data.transaction = await this.cinerino.transaction.placeOrder.start({
            expires: expires,
            seller: {
                id: this.data.movieTheaterOrganization.id,
                typeOf: this.data.movieTheaterOrganization.typeOf
            },
            object: {
                passport: {
                    token: args.passportToken
                }
            }
        });
        this.save();
    }

    /**
     * 座席開放処理
     * @method cancelSeatRegistrationProcess
     */
    public async cancelSeatRegistrationProcess() {
        if (this.data.transaction === undefined
            || this.data.reservationAuthorizationArgs === undefined) {
            throw new Error('status is different');
        }
        await this.cinerino.getServices();
        const cancelSeatReservationArgs = {
            transactionId: this.data.transaction.id,
            // actionId: this.data.tmpSeatReservationAuthorization.id
        };
        await this.cinerino.transaction.placeOrder.cancel(cancelSeatReservationArgs);
        this.data.reservationAuthorizationArgs = undefined;
        this.reset();
    }

    /**
     * 座席登録処理
     * @method seatRegistrationProcess
     */
    public async seatRegistrationProcess(offers: IOffer[]) {
        if (this.data.transaction === undefined
            || this.data.screeningEvent === undefined) {
            throw new Error('status is different');
        }
        await this.cinerino.getServices();
        // 予約中なら座席削除
        // if (this.data.reservationAuthorizationArgs !== undefined) {
        //     const cancelSeatReservationArgs = {
        //         transactionId: this.data.transaction.id,
        //         // actionId: this.data.tmpSeatReservationAuthorization.id
        //     };
        //     await this.cinerino.transaction.placeOrder.cancel(cancelSeatReservationArgs);
        //     this.data.reservationAuthorizationArgs = undefined;
        //     this.save();
        // }

        if (this.data.seatReservationAuthorization !== undefined) {
            // 予約中なら座席削除
            const cancelSeatReservationArgs = {
                transactionId: this.data.transaction.id,
                actionId: this.data.seatReservationAuthorization.id
            };
            await this.cinerino.transaction.placeOrder.voidSeatReservation(cancelSeatReservationArgs);
        }

        const tickets = offers.map((o) => ({
            ticketedSeat: {
                seatSection: o.seatSection,
                seatNumber: o.seatNumber,
                seatRow: '',
                seatingType: '',
                typeOf: factory.chevre.placeType.Seat
            },
            ticketType: {
                id: ''
            }
        }));
        this.data.reservationAuthorizationArgs = {
            transactionId: this.data.transaction.id,
            event: {
                id: this.data.screeningEvent.id
            },
            notes: '',
            clientUser: this.data.transaction.object.clientUser,
            tickets
        };
        this.data.offers = offers;

        // 座席登録
        /*this.data.tmpSeatReservationAuthorization =
            await this.cinerino.transaction.placeOrder.authorizeSeatReservation({
                transactionId: this.data.transaction.id,
                event: {
                    id: this.data.screeningEvent.id
                },
                tickets: {
                    includes: [{}]
                },
                notes: '',
                clientUser: this.data.transaction.object.clientUser

            });*/
        this.data.orderCount = 0;
        this.data.seatReservationAuthorization = undefined;
        this.save();
    }

    /**
     * 券種登録処理
     * @method ticketRegistrationProcess
     */
    public async ticketRegistrationProcess(tickets: { ticketId: string, seatNum: string }[]) {
        if (this.data.transaction === undefined
            || this.data.reservationAuthorizationArgs === undefined
            || this.data.screeningEvent === undefined) {
            throw new Error('status is different');
        }
        await this.cinerino.getServices();

        if (this.data.seatReservationAuthorization !== undefined) {
            // 予約中なら座席削除
            const voidArgs = {
                transactionId: this.data.transaction.id,
                actionId: this.data.seatReservationAuthorization.id
            };
            await this.cinerino.transaction.placeOrder.voidSeatReservation(voidArgs);
        }

        if (this.data.boxAuthorization !== undefined) {
            // クレジットカード登録済みなら削除
            await this.cinerino.transaction.placeOrder.voidBoxPayment({
                transactionId: this.data.transaction.id,
                actionId: this.data.boxAuthorization.id
            });
            this.data.boxAuthorization = undefined;
            this.save();
        }
        // const changeSeatReservationArgs = {
        //     transactionId: this.data.transaction.id,
        //     actionId: this.data.tmpSeatReservationAuthorization.id,
        //     eventIdentifier: this.data.screeningEvent.identifier,
        //     offers: offers
        // };
        // console.log('changeSeatReservationArgs', changeSeatReservationArgs);
        // this.data.seatReservationAuthorization =
        //     await this.cinerino.transaction.placeOrder.changeSeatReservationOffers(changeSeatReservationArgs);
        const rsvArgs = this.data.reservationAuthorizationArgs;
        rsvArgs.tickets = rsvArgs.tickets.map((t) => {
            const match = tickets.find((ticket) => ticket.seatNum === t.ticketedSeat.seatNumber);
            if (match !== undefined) {
                t.ticketType.id = match.ticketId;
                return t;
            }
            throw new Error('seat ticket not found');
        });
        this.data.seatReservationAuthorization =
            await this.cinerino.transaction.placeOrder.authorizeSeatReservation(rsvArgs);
        if (this.data.seatReservationAuthorization === undefined) {
            throw new Error('status is different');
        }
        this.save();
    }

    /**
     * 購入者情報登録処理
     * @method customerContactRegistrationProcess
     */
    public async customerContactRegistrationProcess() {
        if (this.data.transaction === undefined) {
            throw new Error('transaction is undefined');
        }
        if (this.data.movieTheaterOrganization === undefined) {
            throw new Error('movieTheaterOrganization is undefined');
        }
        await this.cinerino.getServices();
        const config: IConfig = this.storage.load('config', SaveType.Local);
        const args = {
            givenName: this.data.movieTheaterOrganization.name.ja,
            familyName: config.cashRegister,
            email: config.email,
            telephone: this.data.movieTheaterOrganization.telephone
        };
        // 入力情報を登録
        this.data.customerContact = await this.cinerino.transaction.placeOrder.setCustomerContact({
            transactionId: this.data.transaction.id,
            contact: args
        });
        /* if (this.user.isNative() && !this.user.isMember()) {
            try {
                const updateRecordsArgs = {
                    datasetName: 'profile',
                    value: {
                        familyName: args.familyName,
                        givenName: args.givenName,
                        email: args.email,
                        telephone: args.telephone
                    }
                };
                await this.awsCognito.updateRecords(updateRecordsArgs);
            } catch (err) {
                console.error(err);
            }
        } */

        this.save();
    }

    /**
     * クレジットカード支払い処理
     */
    /* public async creditCardPaymentProcess() {
        if (this.data.transaction === undefined
            || this.data.paymentCreditCard === undefined) {
            throw new Error('status is different');
        }
        await this.cinerino.getServices();
        if (this.data.creditCardAuthorization !== undefined) {
            // クレジットカード登録済みなら削除
            const cancelCreditCardAuthorizationArgs = {
                transactionId: this.data.transaction.id,
                actionId: this.data.creditCardAuthorization.id
            };
            await this.cinerino.transaction.placeOrder.voidCreditCardPayment(cancelCreditCardAuthorizationArgs);
            this.data.creditCardAuthorization = undefined;
            this.save();
        }
        // クレジットカード登録
        const METHOD_LUMP = '1';
        const createCreditCardAuthorizationArgs = {
            transactionId: this.data.transaction.id,
            orderId: this.createOrderId(),
            amount: this.getTotalPrice(),
            method: METHOD_LUMP,
            creditCard: this.data.paymentCreditCard
        };
        this.data.creditCardAuthorization =
            await this.cinerino.transaction.placeOrder.authorizeCreditCardPayment(createCreditCardAuthorizationArgs);
        this.save();
    } */

    /**
     * クレジットカード支払い処理
     */
    public async boxPaymentProcess(paymentMethod: BoxPaymentMethod) {
        if (this.data.transaction === undefined) {
            throw new Error('status is different');
        }
        await this.cinerino.getServices();
        if (this.data.boxAuthorization !== undefined) {
            // クレジットカード登録済みなら削除
            await this.cinerino.transaction.placeOrder.voidBoxPayment({
                transactionId: this.data.transaction.id,
                actionId: this.data.boxAuthorization.id
            });
            this.data.boxAuthorization = undefined;
            this.save();
        }
        let cash: { received: number; returned: number } | undefined;
        if (
            paymentMethod === factory.boxPaymentMethodType.Cash
            && this.data.cash !== undefined
        ) {
            cash = {
                received: this.data.cash.receive,
                returned: this.data.cash.return
            };
        }
        const args = {
            transactionId: this.data.transaction.id,
            amount: this.getTotalPrice(),
            paymentMethod,
            cash
        };
        this.data.boxAuthorization =
            await this.cinerino.transaction.placeOrder.authorizeBoxPayment(args);
        this.save();
    }

    /**
     * オーダーID生成
     * @method createOrderId
     */
    /* private createOrderId() {
        if (this.data.seatReservationAuthorization === undefined
            || this.data.seatReservationAuthorization.result === undefined
            || this.data.screeningEvent === undefined) {
            throw new Error('status is different');
        }
        const DIGITS = {
            '02': -2,
            '08': -8
        };
        const orderCount = `00${this.data.orderCount}`.slice(DIGITS['02']);
        const tmpReserveNum =
            `00000000${this.data.seatReservationAuthorization.id}`.slice(DIGITS['08']);
        const theaterCode = this.data.screeningEvent.superEvent.location.branchCode;
        const reserveDate = moment().format('YYYYMMDD');
        this.data.orderCount += 1;
        // オーダーID 予約日 + 劇場ID(3桁) + 予約番号(8桁) + オーソリカウント(2桁)
        return `${reserveDate}${theaterCode}${tmpReserveNum}${orderCount}`;
    } */

    /**
     * インセンティブ処理
     */
    /*public async incentiveProcess() {
        if (this.data.transaction === undefined
            || this.user.data.account === undefined) {
            throw new Error('status is different');
        }
        await this.cinerino.getServices();
        this.data.pecorinoAwardAuthorization = await this.cinerino.transaction.placeOrder.createPecorinoAwardAuthorization({
            transactionId: this.data.transaction.id,
            amount: Incentive.WatchingMovies,
            toAccountNumber: this.user.data.account.accountNumber,
            notes: '鑑賞'
        });
        this.data.incentive = Incentive.WatchingMovies;
    }*/

    /**
     * ポイント決済処理
     */
    /*public async pointPaymentProcess() {
        if (this.data.transaction === undefined
            || this.user.data.account === undefined
            || this.data.seatReservationAuthorization === undefined) {
            throw new Error('status is different');
        }
        await this.cinerino.getServices();
        const ticketNames = [];
        let usePoint = 0;
        for (const offer of this.data.seatReservationAuthorization.object.offers) {
            const pointTicket = this.data.pointTickets.find((ticket) => {
                return (ticket.ticketCode === offer.ticketInfo.ticketCode);
            });
            if (pointTicket === undefined) {
                continue;
            }
            ticketNames.push(`${offer.ticketInfo.ticketName} 引換`);
            usePoint += pointTicket.usePoint;
        }

        const notes = ticketNames.join(',');

        await this.cinerino.transaction.placeOrder.createPecorinoPaymentAuthorization({
            transactionId: this.data.transaction.id,
            amount: usePoint,
            fromAccountNumber: this.user.data.account.accountNumber,
            notes: notes
        });
    }*/

    /**
     * 購入登録処理
     */
    public async purchaseRegistrationProcess() {
        if (this.data.transaction === undefined
            || this.data.screeningEvent === undefined) {
            throw new Error('status is different');
        }
        await this.cinerino.getServices();
        let order: factory.order.IOrder;
        try {
            if (this.isReserveMvtk()) {
                // 決済方法として、ムビチケを追加する
                // const createMvtkAuthorizationArgs = {
                //     transactionId: this.data.transaction.id,
                //     mvtk: {
                //         typeOf: factory.action.authorize.discount.mvtk.ObjectType.Mvtk,
                //         price: this.getMvtkTotalPrice(),
                //         seatInfoSyncIn: this.getMvtkSeatInfoSync()
                //     }
                // };
                // console.log('createMvtkAuthorizationArgs', createMvtkAuthorizationArgs);
                // this.data.mvtkAuthorization =
                //     await this.cinerino.transaction.placeOrder.createMvtkAuthorization(createMvtkAuthorizationArgs);
            }
            /*const incentives = [];
            if (this.user.isMember()
                && !this.isReservePoint()
                && this.user.data.account !== undefined) {
                incentives.push({
                    amount: Incentive.WatchingMovies,
                    toAccountNumber: this.user.data.account.accountNumber
                });
            }*/
            // 取引確定
            order = (await this.cinerino.transaction.placeOrder.confirm({
                transactionId: this.data.transaction.id,
                sendEmailMessage: true
            })).order;
        } catch (err) {
            /*if (this.isReserveMvtk()) {
                await this.cancelMvtksSatInfoSync(0);
            }*/
            throw err;
        }

        if (this.isReserveMvtk()) {
            // ムビチケ使用
            const mvtksSatInfoSyncArgs = this.getMvtkSeatInfoSync(order.confirmationNumber);
            await this.cinerino.mvtksSeatInfoSync(mvtksSatInfoSyncArgs);
        }
        const complete = {
            order: order,
            transaction: this.data.transaction,
            movieTheaterOrganization: this.data.movieTheaterOrganization,
            // incentive: this.data.incentive
        };
        this.storage.save('complete', complete, SaveType.Session);

        try {
            // Google Analytics
            const sendData = {
                hitType: 'event',
                eventCategory: 'purchase',
                eventAction: 'complete',
                eventLabel: `conversion-${this.data.screeningEvent.location.branchCode}`
            };
            ga('send', sendData);
        } catch (err) {
            console.error(err);
        }

        /* if (this.user.isNative() && !this.user.isMember()) {
            // アプリ非会員ならCognitoへ登録
            try {
                const reservationRecord = await this.awsCognito.getRecords({
                    datasetName: 'reservation'
                });
                if (reservationRecord.orders === undefined) {
                    reservationRecord.orders = [];
                }
                reservationRecord.orders.push(order);
                (<factory.order.IOrder[]>reservationRecord.orders).forEach((recordOrder, index) => {
                    const itemOffered = recordOrder.acceptedOffers[0].itemOffered;
                    if (itemOffered.typeOf !== factory.chevre.reservationType.EventReservation) {
                        return;
                    }
                    const endDate = moment(itemOffered.reservationFor.endDate).unix();
                    const limitDate = moment().subtract(1, 'month').unix();
                    if (endDate < limitDate) {
                        reservationRecord.orders.splice(index, 1);
                    }
                });
                const updateRecordsArgs = {
                    datasetName: 'reservation',
                    value: reservationRecord
                };
                await this.awsCognito.updateRecords(updateRecordsArgs);
            } catch (err) {
                console.error('awsCognito: updateRecords', err);
            }
        } */
        // プッシュ通知登録
        /* try {
            const itemOffered = order.acceptedOffers[0].itemOffered;
            if (itemOffered.typeOf !== factory.chevre.reservationType.EventReservation) {
                throw new Error('itemOffered.typeOf is not EventReservation');
            }
            const reservationFor = itemOffered.reservationFor;
            const localNotificationArgs = {
                id: Number(order.orderNumber.replace(/\-/g, '')), // ID
                title: '鑑賞時間が近づいています。', // タイトル
                text: '劇場 / スクリーン: ' + reservationFor.superEvent.location.name.ja + '/' + reservationFor.location.name.ja + '\n' +
                    '作品名: ' + reservationFor.workPerformed.name + '\n' +
                    '上映開始: ' + moment(reservationFor.startDate).format('YYYY/MM/DD HH:mm'), // テキスト
                trigger: {
                    at: moment(reservationFor.startDate).subtract(30, 'minutes').toISOString() // 通知を送る時間（ISO）
                },
                foreground: true // 前面表示（デフォルトは前面表示しない）
            };
            this.callNative.localNotification(localNotificationArgs);
        } catch (err) {
            console.error(err);
        } */

        // 購入情報削除
        this.reset();
    }

    /**
     * ムビチケ着券取り消し
     */
    /*public async cancelMvtksSatInfoSync(count: number) {
        // console.log('cancelMvtksSatInfoSync', count);
        try {
            // ムビチケ使用なら削除
            const deleteFlag = '1';
            const mvtksSatInfoSyncArgs = this.getMvtkSeatInfoSync({
                deleteFlag: deleteFlag
            });
            await this.cinerino.mvtksSeatInfoSync(mvtksSatInfoSyncArgs);
        } catch (err) {
            const limit = 3;
            if (count > limit) {
                throw err;
            }
            await this.cancelMvtksSatInfoSync(count + 1);
        }

    }*/

    /**
     * ムビチケ認証処理
     */
    public async mvtkAuthenticationProcess(mvtkInputDataList: {
        knyknrNo: string;
        pinCd: string;
    }[]) {
        if (this.data.screeningEvent === undefined) {
            throw new Error('status is different');
        }
        await this.cinerino.getServices();
        const DIGITS = -2;
        const eventInfo = this.data.screeningEvent;
        const valid = '1';
        const purchaseNumberAuthArgs = {
            kgygishCd: environment.MVTK_COMPANY_CODE,
            jhshbtsCd: <any>valid,
            knyknrNoInfoIn: mvtkInputDataList,
            skhnCd: eventInfo.workPerformed.identifier,
            stCd: `00${eventInfo.superEvent.location.branchCode}`.slice(DIGITS),
            jeiYmd: moment(eventInfo.doorTime).format('YYYY/MM/DD')
        };
        const mvtkPurchaseNumberAuthResult = await this.cinerino.mvtkPurchaseNumberAuth(purchaseNumberAuthArgs);
        const success = 'N000';
        if (mvtkPurchaseNumberAuthResult.resultInfo.status !== success
            || mvtkPurchaseNumberAuthResult.ykknmiNumSum === null
            || mvtkPurchaseNumberAuthResult.ykknmiNumSum === 0
            || mvtkPurchaseNumberAuthResult.knyknrNoInfoOut === null) {
            throw new Error('mvtkPurchaseNumberAuth error');
        }
        const results = [];
        for (const knyknrNoInfo of mvtkPurchaseNumberAuthResult.knyknrNoInfoOut) {
            if (knyknrNoInfo.ykknInfo === null) {
                continue;
            }
            for (const ykknInfo of knyknrNoInfo.ykknInfo) {
                // const mvtkTicketcodeArgs = {
                //     theaterCode: eventInfo.superEvent.location.branchCode,
                //     kbnDenshiken: knyknrNoInfo.dnshKmTyp,
                //     kbnMaeuriken: knyknrNoInfo.znkkkytsknGkjknTyp,
                //     kbnKensyu: ykknInfo.ykknshTyp,
                //     salesPrice: Number(ykknInfo.knshknhmbiUnip),
                //     appPrice: Number(ykknInfo.kijUnip),
                //     kbnEisyahousiki: ykknInfo.eishhshkTyp,
                //     titleCode: (<any>eventInfo).titleCode,
                //     titleBranchNum: (<any>eventInfo).titleBranchNum
                // };
                const mvtkTicketcodeResult = await this.cinerino.mvtkTicket({ticketCode: ykknInfo.ykknshTyp});
                // console.log('mvtkTicketcodeResult', mvtkTicketcodeResult);
                const data = {
                    mvtkTicketcodeResult: mvtkTicketcodeResult,
                    knyknrNoInfo: knyknrNoInfo,
                    ykknInfo: ykknInfo,
                    input: mvtkInputDataList.find((mvtkInputData) => {
                        return (mvtkInputData.knyknrNo === knyknrNoInfo.knyknrNo);
                    })
                };
                results.push(data);
            }
        }
        this.data.mvtkTickets = results;
        this.save();
    }
}
