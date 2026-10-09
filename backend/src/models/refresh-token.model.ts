import { type InferSchemaType, model, Schema } from 'mongoose';

/**
 * One row per issued refresh token. Tokens rotate on every use: the old row gets `revokedAt`
 * and `replacedBy`, and the new row shares its `family`. Presenting an already-revoked token
 * means it was stolen or replayed, so the whole family is revoked.
 */
const refreshTokenSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    family: { type: String, required: true, index: true },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date, default: null },
    replacedBy: { type: Schema.Types.ObjectId, ref: 'RefreshToken', default: null },
    userAgent: { type: String },
    ip: { type: String },
  },
  { timestamps: true },
);

// MongoDB removes expired rows itself (the TTL monitor runs about once a minute).
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type RefreshTokenDoc = InferSchemaType<typeof refreshTokenSchema>;
export const RefreshToken = model('RefreshToken', refreshTokenSchema);
