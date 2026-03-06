// Application types

export interface AppEnv {
  Variables: {
    session: SessionData | null;
  };
}

export interface SessionData {
  userId: string;
  email: string;
  name?: string;
  picture?: string;
  expiresAt: Date;
}
