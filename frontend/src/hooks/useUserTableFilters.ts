import { useMemo } from "react";
import { startOfDay, endOfDay } from "date-fns";
import type { DateRange } from "react-day-picker";
import type { UserAdminRead } from "@/types/permission-role";
import { usePageFilters } from "@/hooks/usePageFilters";
import type { PaginationState } from "@tanstack/react-table";

export const useUserTableFilters = (users: UserAdminRead[], pageKey: string = "adminUsers") => {
  const { filters, setFilter, resetFilters } = usePageFilters(pageKey, {
    searchFilter: "",
    statusFilter: [] as string[],
    roleFilter: [] as string[],
    dateRange: {
      from: undefined,
      to: undefined,
    } as DateRange | undefined,
    pagination: {
      pageIndex: 0,
      pageSize: 10,
    } as PaginationState,
  });

  const {
    searchFilter,
    statusFilter,
    roleFilter,
    dateRange,
    pagination,
  } = filters;

  const setSearchFilter = (val: string) => setFilter("searchFilter", val);
  const setStatusFilter = (val: string[]) => setFilter("statusFilter", val);
  const setRoleFilter = (val: string[]) => setFilter("roleFilter", val);
  const setDateRange = (val: DateRange | undefined) => setFilter("dateRange", val);
  const setPagination = (val: PaginationState | ((prev: PaginationState) => PaginationState)) => {
    if (typeof val === "function") {
      setFilter("pagination", val(pagination));
    } else {
      setFilter("pagination", val);
    }
  };

  const minDate = useMemo(() => {
    if (users.length === 0) return new Date();
    const dates = users
      .filter((u) => u.created_at)
      .map((u) => new Date(u.created_at!).getTime());
    if (dates.length === 0) return new Date();
    return new Date(Math.min(...dates));
  }, [users]);

  const roleOptions = useMemo(() => {
    const set = new Set<string>();
    users.forEach((u) => {
      if (u.role_name) set.add(u.role_name);
    });
    return Array.from(set).sort();
  }, [users]);

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      // Status filter
      if (statusFilter.length > 0) {
        const userStatus = u.is_active ? "active" : "inactive";
        if (!statusFilter.includes(userStatus)) return false;
      }

      // Role filter
      if (roleFilter.length > 0) {
        if (!roleFilter.includes(u.role_name)) return false;
      }

      // Date range filter (created_at)
      if (u.created_at && (dateRange?.from || dateRange?.to)) {
        const d = new Date(u.created_at);
        if (dateRange.from && d < startOfDay(dateRange.from)) return false;
        if (dateRange.to && d > endOfDay(dateRange.to)) return false;
      }

      return true;
    });
  }, [users, searchFilter, statusFilter, roleFilter, dateRange]);

  const hasActiveFilters =
    !!searchFilter ||
    statusFilter.length > 0 ||
    roleFilter.length > 0 ||
    !!dateRange?.from ||
    !!dateRange?.to;

  const clearFilters = () => {
    resetFilters();
  };

  return {
    searchFilter,
    setSearchFilter,
    statusFilter,
    setStatusFilter,
    roleFilter,
    setRoleFilter,
    dateRange,
    setDateRange,
    roleOptions,
    filteredUsers,
    hasActiveFilters,
    clearFilters,
    minDate,
    pagination,
    setPagination,
  };
};
