/**
 * Job search component for filtering available job postings.
 * Provides a search interface for querying jobs by title and description.
 */

import { useState, useEffect } from "react";
import SearchBar from "@/components/shared/SearchBar";
import { extractErrorMessage } from "@/utils/error";
import { useSearchJobsQuery } from "@/hooks/queries/jobs/useSearchJobs";

/**
 * Props for the JobSearch component.
 */
interface JobSearchProps {
  /** Callback when search results are returned */
  onResultsFound: (jobs: any[]) => void;
  /** Callback when search query is cleared */
  onClear: () => void;
  /** Callback when an error occurs during search */
  onError: (message: string) => void;
  /** Whether search is in progress */
  onSearching: (searching: boolean) => void;
}

/**
 * Job search component with input field and search logic.
 * Encapsulates the job search functionality for reusability.
 */
const JobSearch = ({ onResultsFound, onClear, onError, onSearching }: JobSearchProps) => {
  const [query, setQuery] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  const { data, isFetching: isLoading, error, isSuccess } = useSearchJobsQuery(searchTerm, {
    enabled: !!searchTerm.trim()
  });

  useEffect(() => {
    onSearching(isLoading);
  }, [isLoading, onSearching]);

  useEffect(() => {
    if (isSuccess && data) {
      onResultsFound(data.data);
    }
  }, [isSuccess, data, onResultsFound]);

  useEffect(() => {
    if (error) {
      const errorMessage = extractErrorMessage(error);
      console.error(errorMessage || "Failed to search jobs:", error);
      onError("Failed to search jobs. Please try again.");
    }
  }, [error, onError]);

  /**
   * Handles the search form submission.
   * Updates the search term to trigger the query.
   */
  const handleSearch = (e: React.SyntheticEvent) => {
    if (e) e.preventDefault();

    if (!query.trim()) {
      onClear();
      setSearchTerm("");
      return;
    }

    setSearchTerm(query);
  };

  /**
   * Handles input changes and clears results if input is emptied.
   */
  const handleQueryChange = (value: string) => {
    setQuery(value);
    if (!value.trim()) {
      onClear();
    }
  };

  return (
    <SearchBar
      placeholder="Search jobs by title or description..."
      value={query}
      onChange={handleQueryChange}
      onSearch={handleSearch}
      isLoading={isLoading}
    />
  );
};

export default JobSearch;
