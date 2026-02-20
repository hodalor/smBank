const mongoose = require('mongoose');

let connected = false;
let Models = null;

async function connect(uri) {
  if (!uri) return null;
  if (connected) return Models;
  await mongoose.connect(uri, { dbName: 'smbank' });
  connected = true;

  const { Schema, model } = mongoose;
  const Mixed = Schema.Types.Mixed;

  const UserSchema = new Schema({
    username: { type: String, unique: true, index: true },
    passwordHash: String,
    role: String,
    enabled: { type: Boolean, default: true },
    // HR fields
    fullName: String,
    email: String,
    phone: String,
    department: String,
    position: String,
    dateEmployed: String,
    contractEndDate: String,
    accountCreatedAt: { type: String },
    employeeNumber: { type: String, unique: true, index: true },
    // Permission overrides
    permsAdd: [String],
    permsRemove: [String],
  }, { timestamps: true });

  const ConfigSchema = new Schema({
    appName: String,
    footerText: String,
    primary: String,
    primaryContrast: String,
    darkMode: Boolean,
    defaultLoanRate: { type: Number, default: 0 },
    serviceFeeRate: { type: Number, default: 0 },
    adminFeeRate: { type: Number, default: 0 },
    commitmentFeeRate: { type: Number, default: 0 },
    withdrawalFeeRate: { type: Number, default: 0 },
    loanOverdueGraceDays: { type: Number, default: 0 },
    loanOverdueDailyPenaltyRate: { type: Number, default: 0 },
    bankCode: { type: String, default: '07' }, // 2 digits
    branches: [{
      code: String, // 3 digits
      name: String,
      active: { type: Boolean, default: true },
    }],
    accountTypes: [{
      code: String, // 2 digits
      name: String,
      supportsIndividual: { type: Boolean, default: true },
      active: { type: Boolean, default: true },
    }],
    lastCustomerSerial: { type: Number, default: 0 }, // global running serial
  }, { timestamps: true });

  const SuperBinSchema = new Schema({
    by: String,
    deletedAt: Date,
    kind: String,
    payload: Mixed,
  }, { timestamps: true });

  const ClientSchema = new Schema({
    id: String,
    accountNumber: { type: String, unique: true, index: true },
    fullName: String,
    companyName: String,
    nationalId: String,
    dob: String,
    registrationDate: String,
    phone: String,
    companyPhone: String,
    data: Mixed,
    createdAt: String,
  }, { timestamps: true });

  const TxnSchema = new Schema({
    id: { type: String, index: true },
    kind: String, // deposit | withdraw
    status: String,
    initiatorName: String,
    initiatedAt: String,
    accountNumber: String,
    amount: Number,
    meta: Mixed,
    approvedAt: String,
    approverName: String,
  }, { timestamps: true });

  const LoanSchema = new Schema({
    id: { type: String, index: true },
    accountNumber: String,
    principal: Number,
    rate: Number,
    termMonths: Number,
    totalInterest: { type: Number, default: 0 },
    serviceFee: { type: Number, default: 0 },
    adminFee: { type: Number, default: 0 },
    commitmentFee: { type: Number, default: 0 },
    totalFees: { type: Number, default: 0 },
    totalDue: { type: Number, default: 0 },
    guarantors: Mixed,
    collateral: Mixed,
    attachments: Mixed,
    createdAt: String,
    status: String, // Pending | Active
    approvedAt: String,
    approverName: String,
    initiatorName: String,
  }, { timestamps: true });

  const LoanRepaySchema = new Schema({
    id: { type: String, index: true },
    loanId: String,
    accountNumber: String,
    mode: String, // full | partial | writeoff
    amount: Number,
    status: String, // Pending | Approved
    initiatorName: String,
    initiatedAt: String,
    approvedAt: String,
    approverName: String,
  }, { timestamps: true });

  const ActivitySchema = new Schema({
    ts: { type: Date, index: true },
    actor: String,
    role: String,
    action: String,
    entityType: String,
    entityId: String,
    details: Mixed,
    ip: String,
    ua: String,
    method: String,
    path: String,
  }, { timestamps: true });
  
  const ServerLogSchema = new Schema({
    ts: { type: Date, index: true },
    level: String, // info | error
    method: String,
    path: String,
    status: Number,
    durationMs: Number,
    actor: String,
    role: String,
    ip: String,
    ua: String,
    params: Mixed,
    query: Mixed,
    body: Mixed,
    errorMessage: String,
    errorStack: String,
  }, { timestamps: true });

  Models = {
    User: model('User', UserSchema),
    Config: model('Config', ConfigSchema),
    SuperBin: model('SuperBin', SuperBinSchema),
    Client: model('Client', ClientSchema),
    PendingTxn: model('PendingTxn', TxnSchema),
    PostedTxn: model('PostedTxn', TxnSchema),
    Loan: model('Loan', LoanSchema),
    LoanRepayPending: model('LoanRepayPending', LoanRepaySchema),
    LoanRepayPosted: model('LoanRepayPosted', LoanRepaySchema),
    ActivityLog: model('ActivityLog', ActivitySchema),
    ServerLog: model('ServerLog', ServerLogSchema),
  };
  try {
    await Models.User.init(); // ensure indexes (unique on employeeNumber, username)
  } catch {}
  return Models;
}

function isConnected() {
  return connected;
}

function getModels() {
  return Models;
}

module.exports = { connect, isConnected, getModels };
