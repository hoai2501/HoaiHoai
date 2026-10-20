import { useMemo, useState } from "react";

function usePagination<T>(
  data: T[],
  itemsPerPage: number
) {
  const [currentPage, setCurrentPage] = useState(1);

  const totalPages = Math.ceil(
    data.length / itemsPerPage
  );

  const currentItems = useMemo(() => {
    const startIndex =
      (currentPage - 1) * itemsPerPage;

    const endIndex =
      startIndex + itemsPerPage;

    return data.slice(startIndex, endIndex);
  }, [data, currentPage, itemsPerPage]);

  const next = () => {
    setCurrentPage((page) =>
      Math.min(page + 1, totalPages)
    );
  };

  const prev = () => {
    setCurrentPage((page) =>
      Math.max(page - 1, 1)
    );
  };

  const goToPage = (page: number) => {
    const validPage = Math.min(
      Math.max(page, 1),
      totalPages
    );

    setCurrentPage(validPage);
  };

  return {
    currentPage,
    totalPages,
    currentItems,
    next,
    prev,
    goToPage,
  };
}

export default usePagination;