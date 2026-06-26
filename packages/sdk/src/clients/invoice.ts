import { Address, nativeToScVal, scValToNative, xdr } from '@stellar/stellar-sdk';
import { BaseContractClient } from '../base.js';
import { AssetType, Invoice, InvoiceStatus } from '../types/index.js';

function parseBytes(val: unknown): string {
  if (!val) return '';
  if (typeof val === 'string') return val;
  if (val instanceof Uint8Array || Buffer.isBuffer(val)) {
    return Buffer.from(val).toString('hex');
  }
  return String(val);
}

function parseInvoice(native: unknown): Invoice {
  const getBigInt = (v: unknown) => typeof v === 'bigint' ? v : BigInt(String(v || 0));
  const getNumber = (v: unknown) => typeof v === 'bigint' ? Number(v) : Number(v || 0);
  const getBoolean = (v: unknown) => !!v;
  
  let id = '';
  let issuer = '';
  let buyer = '';
  let faceValue = 0n;
  let asset: AssetType = 'USDC';
  let discountBps = 0;
  let fundedAmount = 0n;
  let dueDate = 0;
  let status: InvoiceStatus = 'Created';
  let createdAt = 0;
  let fundedAt: number | null = null;
  let shippedAt: number | null = null;
  let issuerConfirmed = false;
  let buyerConfirmed = false;
  let buyerConfirmedAt: number | null = null;
  let repaidAt: number | null = null;

  if (native instanceof Map) {
    id = parseBytes(native.get('id'));
    issuer = native.get('issuer')?.toString() || '';
    buyer = native.get('buyer')?.toString() || '';
    faceValue = getBigInt(native.get('face_value'));
    asset = (native.get('asset')?.toString() || 'USDC') as AssetType;
    discountBps = getNumber(native.get('discount_bps'));
    fundedAmount = getBigInt(native.get('funded_amount'));
    dueDate = getNumber(native.get('due_date'));
    status = (native.get('status')?.toString() || 'Created') as InvoiceStatus;
    createdAt = getNumber(native.get('created_at'));
    fundedAt = native.get('funded_at') ? getNumber(native.get('funded_at')) : null;
    shippedAt = native.get('shipped_at') ? getNumber(native.get('shipped_at')) : null;
    issuerConfirmed = getBoolean(native.get('issuer_confirmed'));
    buyerConfirmed = getBoolean(native.get('buyer_confirmed'));
    buyerConfirmedAt = native.get('buyer_confirmed_at') ? getNumber(native.get('buyer_confirmed_at')) : null;
    repaidAt = native.get('repaid_at') ? getNumber(native.get('repaid_at')) : null;
  } else if (typeof native === 'object' && native !== null) {
    const obj = native as Record<string, unknown>;
    id = parseBytes(obj.id);
    issuer = obj.issuer?.toString() || '';
    buyer = obj.buyer?.toString() || '';
    faceValue = getBigInt(obj.face_value);
    asset = (obj.asset?.toString() || 'USDC') as AssetType;
    discountBps = getNumber(obj.discount_bps);
    fundedAmount = getBigInt(obj.funded_amount);
    dueDate = getNumber(obj.due_date);
    status = (obj.status?.toString() || 'Created') as InvoiceStatus;
    createdAt = getNumber(obj.created_at);
    fundedAt = obj.funded_at ? getNumber(obj.funded_at) : null;
    shippedAt = obj.shipped_at ? getNumber(obj.shipped_at) : null;
    issuerConfirmed = getBoolean(obj.issuer_confirmed);
    buyerConfirmed = getBoolean(obj.buyer_confirmed);
    buyerConfirmedAt = obj.buyer_confirmed_at ? getNumber(obj.buyer_confirmed_at) : null;
    repaidAt = obj.repaid_at ? getNumber(obj.repaid_at) : null;
  }

  return {
    id,
    issuer,
    buyer,
    faceValue,
    asset,
    discountBps,
    fundedAmount,
    dueDate,
    status,
    createdAt,
    fundedAt,
    shippedAt,
    issuerConfirmed,
    buyerConfirmed,
    buyerConfirmedAt,
    repaidAt,
  };
}

export class InvoiceClient extends BaseContractClient {
  async create(
    issuer: string,
    buyer: string,
    faceValue: bigint,
    dueDate: number,
    signerPublicKey: string
  ): Promise<string> {
    const args = [
      new Address(issuer).toScVal(),
      new Address(buyer).toScVal(),
      nativeToScVal(faceValue, { type: 'u128' }),
      nativeToScVal(BigInt(dueDate), { type: 'u64' }),
    ];
    return this.writeContract('create', args, signerPublicKey);
  }

  async listForFinancing(
    invoiceIdHex: string,
    discountBps: number,
    signerPublicKey: string
  ): Promise<boolean> {
    const args = [
      xdr.ScVal.scvBytes(Buffer.from(invoiceIdHex, 'hex')),
      nativeToScVal(discountBps, { type: 'u32' }),
    ];
    return this.writeContract('list_for_financing', args, signerPublicKey).then(() => true);
  }

  async markShipped(invoiceIdHex: string, signerPublicKey: string): Promise<boolean> {
    const args = [xdr.ScVal.scvBytes(Buffer.from(invoiceIdHex, 'hex'))];
    return this.writeContract('mark_shipped', args, signerPublicKey).then(() => true);
  }

  async confirmDelivery(
    invoiceIdHex: string,
    confirmerAddress: string,
    signerPublicKey: string
  ): Promise<boolean> {
    const args = [
      xdr.ScVal.scvBytes(Buffer.from(invoiceIdHex, 'hex')),
      new Address(confirmerAddress).toScVal(),
    ];
    return this.writeContract('confirm_delivery', args, signerPublicKey).then(() => true);
  }

  async repay(invoiceIdHex: string, signerPublicKey: string): Promise<boolean> {
    const args = [xdr.ScVal.scvBytes(Buffer.from(invoiceIdHex, 'hex'))];
    return this.writeContract('repay', args, signerPublicKey).then(() => true);
  }

  async triggerDefault(invoiceIdHex: string, signerPublicKey: string): Promise<boolean> {
    const args = [xdr.ScVal.scvBytes(Buffer.from(invoiceIdHex, 'hex'))];
    return this.writeContract('trigger_default', args, signerPublicKey).then(() => true);
  }

  async get(invoiceIdHex: string, signerPublicKey: string): Promise<Invoice> {
    const args = [xdr.ScVal.scvBytes(Buffer.from(invoiceIdHex, 'hex'))];
    return this.readContract(
      'get',
      args,
      signerPublicKey,
      (val) => parseInvoice(scValToNative(val))
    );
  }

  async getByStatus(status: InvoiceStatus, signerPublicKey: string): Promise<Invoice[]> {
    const args = [nativeToScVal(status, { type: 'symbol' })];
    return this.readContract(
      'get_by_status',
      args,
      signerPublicKey,
      (val) => {
        const native = scValToNative(val);
        if (!Array.isArray(native)) return [];
        return native.map(parseInvoice);
      }
    );
  }

  async getByIssuer(address: string, signerPublicKey: string): Promise<Invoice[]> {
    const args = [new Address(address).toScVal()];
    return this.readContract(
      'get_by_issuer',
      args,
      signerPublicKey,
      (val) => {
        const native = scValToNative(val);
        if (!Array.isArray(native)) return [];
        return native.map(parseInvoice);
      }
    );
  }

  async getByBuyer(address: string, signerPublicKey: string): Promise<Invoice[]> {
    const args = [new Address(address).toScVal()];
    return this.readContract(
      'get_by_buyer',
      args,
      signerPublicKey,
      (val) => {
        const native = scValToNative(val);
        if (!Array.isArray(native)) return [];
        return native.map(parseInvoice);
      }
    );
  }
}
