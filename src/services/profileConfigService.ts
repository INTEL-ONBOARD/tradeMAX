import { ProfileConfigModel } from "../db/models/ProfileConfig.js";
import { getUserDoc, updateSettings } from "./authService.js";
import type { EngineConfig, ProfileConfigRecord, TradingProfile, UserSettings } from "../shared/types.js";

type EngineConfigPatch = Omit<Partial<EngineConfig>, "stageModels"> & {
  stageModels?: Partial<EngineConfig["stageModels"]>;
};

function mergeEngineConfig(base: EngineConfig, patch: EngineConfigPatch): EngineConfig {
  return {
    ...base,
    ...patch,
    tradingProfile: patch.tradingProfile ?? base.tradingProfile,
    stageModels: {
      ...base.stageModels,
      ...(patch.stageModels ?? {}),
    },
    watchlist: patch.watchlist !== undefined ? [...patch.watchlist] : [...base.watchlist],
    votingModels: patch.votingModels !== undefined ? [...patch.votingModels] : [...base.votingModels],
  };
}

function mapProfileConfig(doc: {
  _id: { toString(): string } | string;
  userId: { toString(): string } | string;
  name: string;
  profile: TradingProfile;
  config: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}): ProfileConfigRecord {
  return {
    _id: doc._id.toString(),
    userId: doc.userId.toString(),
    name: doc.name,
    profile: doc.profile,
    config: doc.config as unknown as EngineConfig,
    createdAt: new Date(doc.createdAt).toISOString(),
    updatedAt: new Date(doc.updatedAt).toISOString(),
  };
}

export async function listProfileConfigs(userId: string, profile?: TradingProfile): Promise<ProfileConfigRecord[]> {
  const rows = await ProfileConfigModel.find({
    userId,
    ...(profile ? { profile } : {}),
  })
    .sort({ updatedAt: -1 })
    .lean();

  return rows.map((row) => mapProfileConfig(row));
}

export async function saveProfileConfig(args: {
  userId: string;
  name: string;
  profile: TradingProfile;
  config: EngineConfigPatch;
}): Promise<ProfileConfigRecord> {
  const user = await getUserDoc(args.userId);
  const mergedConfig = mergeEngineConfig(user.engineConfig as EngineConfig, {
    ...args.config,
    tradingProfile: args.profile,
  });

  const doc = await ProfileConfigModel.findOneAndUpdate(
    { userId: args.userId, profile: args.profile, name: args.name },
    {
      userId: args.userId,
      name: args.name,
      profile: args.profile,
      config: mergedConfig,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  ).lean();

  if (!doc) throw new Error("PROFILE_CONFIG_SAVE_FAILED");
  return mapProfileConfig(doc);
}

export async function applyProfileConfig(args: {
  userId: string;
  profileConfigId: string;
}): Promise<{ settings: UserSettings; profileConfig: ProfileConfigRecord }> {
  const doc = await ProfileConfigModel.findOne({
    _id: args.profileConfigId,
    userId: args.userId,
  }).lean();

  if (!doc) {
    throw new Error("PROFILE_CONFIG_NOT_FOUND");
  }

  const updated = await updateSettings(args.userId, {
    engineConfig: {
      ...doc.config,
      tradingProfile: doc.profile,
    },
  });

  return {
    settings: updated,
    profileConfig: mapProfileConfig(doc),
  };
}

export async function deleteProfileConfig(args: {
  userId: string;
  profileConfigId: string;
}): Promise<{ deleted: boolean }> {
  const result = await ProfileConfigModel.deleteOne({
    _id: args.profileConfigId,
    userId: args.userId,
  });

  if (result.deletedCount === 0) {
    throw new Error("PROFILE_CONFIG_NOT_FOUND");
  }

  return { deleted: true };
}
