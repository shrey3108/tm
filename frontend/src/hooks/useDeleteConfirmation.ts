/**
 * Custom hook for managing delete confirmation dialogs.
 * Provides state and handlers for showing a confirmation modal before deletion.
 * Supports both raw async functions and TanStack Query mutation results.
 */

import { useState, useCallback } from "react";
import { extractErrorMessage } from "@/utils/error";
import type { UseMutationResult } from "@tanstack/react-query";

/**
 * Options for configuring the useDeleteConfirmation hook.
 * @typeParam T - The type of item being deleted
 *
 * Provide either `deleteFn` (legacy) or `mutation` (preferred), not both.
 * When `mutation` is provided, loading and error state are derived from
 * the mutation itself, and cache invalidation is handled automatically.
 */
interface UseDeleteConfirmationOptions<T> {
  /** Optional callback fired after successful deletion */
  onSuccess?: () => void;
  /** Async function to perform the delete operation (legacy approach) */
  deleteFn?: (id: string | number) => Promise<void>;
  /**
   * TanStack Query mutation result for delete operations (preferred approach).
   * When provided, `deleteFn` is ignored and loading/error state comes from the mutation.
   */
  mutation?: UseMutationResult<void, Error, string>;
  /** Function to generate display title from item (default: "this item") */
  itemTitle?: (item: T) => string;
}

/**
 * Hook for managing delete confirmation modal state.
 * @param options - Configuration options including delete function and callbacks
 * @returns State and handlers for the delete confirmation dialog
 * @example
 * ```ts
 * // Using with a mutation (preferred)
 * const deleteMutation = useDeleteUserMutation();
 * const { showModal, handleDeleteClick, handleConfirm, isDeleting, error } = useDeleteConfirmation({
 *   mutation: deleteMutation,
 *   onSuccess: () => toast.success("Deleted!"),
 *   itemTitle: (user) => user.name,
 * });
 *
 * // Legacy usage with raw deleteFn
 * const { showModal, handleDeleteClick, handleConfirm, isDeleting, error } = useDeleteConfirmation({
 *   deleteFn: (id) => deleteUser(id),
 *   onSuccess: () => refetchUsers(),
 *   itemTitle: (user) => user.name,
 * });
 * ```
 */
export const useDeleteConfirmation = <T extends { id: string | number }>(
  options: UseDeleteConfirmationOptions<T>,
) => {
  const { onSuccess, deleteFn, mutation, itemTitle = () => "this item" } = options;
  const [showModal, setShowModal] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<T | null>(null);
  // Local state for legacy (non-mutation) mode
  const [localIsDeleting, setLocalIsDeleting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  // Derive loading and error from mutation when available, otherwise use local state
  const isDeleting = mutation ? mutation.isPending : localIsDeleting;
  const error = mutation
    ? mutation.isError
      ? extractErrorMessage(mutation.error, "Failed to delete item.")
      : null
    : localError;

  const handleDeleteClick = useCallback((item: T) => {
    setItemToDelete(item);
    setLocalError(null);
    mutation?.reset();
    setShowModal(true);
  }, [mutation]);

  const handleClose = useCallback(() => {
    if (!isDeleting) {
      setShowModal(false);
      setItemToDelete(null);
      mutation?.reset();
    }
  }, [isDeleting, mutation]);

  const handleConfirm = useCallback(async () => {
    if (!itemToDelete) return;

    if (mutation) {
      // Mutation-based flow
      try {
        await mutation.mutateAsync(String(itemToDelete.id));
        setShowModal(false);
        setItemToDelete(null);
        if (onSuccess) onSuccess();
      } catch {
        // Error is captured by the mutation state, no need to handle here
      }
    } else if (deleteFn) {
      // Legacy flow
      try {
        setLocalIsDeleting(true);
        setLocalError(null);
        await deleteFn(itemToDelete.id);
        setShowModal(false);
        setItemToDelete(null);
        if (onSuccess) onSuccess();
      } catch (err) {
        setLocalError(extractErrorMessage(err, "Failed to delete item."));
      } finally {
        setLocalIsDeleting(false);
      }
    }
  }, [deleteFn, mutation, itemToDelete, onSuccess]);

  return {
    showModal,
    itemToDelete,
    isDeleting,
    error,
    handleDeleteClick,
    handleClose,
    handleConfirm,
    message: itemToDelete
      ? `Are you sure you want to delete ${itemTitle(itemToDelete)}? This action cannot be undone.`
      : "",
  };
};
