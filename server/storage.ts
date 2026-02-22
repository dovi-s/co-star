import { type User, type UpsertUser } from "@shared/schema";
import { authStorage } from "./replit_integrations/auth";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
}

export const storage: IStorage = {
  getUser: (id: string) => authStorage.getUser(id),
};
