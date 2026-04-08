import type { Request } from "express";

export interface JwtPayload {
  sub: string;
  email: string;
  name: string;
  role: string;
  institutionId: number | null;
  iat?: number;
  exp?: number;
}

export interface ResolvedUser {
  id: number;
  email: string;
  name: string;
  role: string;
  institutionId: number | null;
}

export type RequestWithAuth = Request & {
  traceId?: string;
  user?: ResolvedUser;
  institutionId?: number;
};

export type Role = "platform_admin" | "institution_admin" | "lecturer" | "student";

export const ROLES = {
  PLATFORM_ADMIN:    "platform_admin"    as Role,
  INSTITUTION_ADMIN: "institution_admin" as Role,
  LECTURER:          "lecturer"          as Role,
  STUDENT:           "student"           as Role,
};

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export function paginate<T>(
  data: T[],
  total: number,
  page: number,
  limit: number
): PaginatedResult<T> {
  return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
}

export function parsePagination(query: Record<string, unknown>): {
  page: number;
  limit: number;
  skip: number;
} {
  const page  = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
  return { page, limit, skip: (page - 1) * limit };
}
