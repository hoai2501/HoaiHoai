import usePagination from "../hooks/usePagination";
import { products } from "../data/products";

function ProductList() {
  const {
    currentPage,
    totalPages,
    currentItems,
    next,
    prev,
    goToPage,
  } = usePagination(products, 3);

  return (
    <div>
      <h2>Danh sách sản phẩm</h2>

      {currentItems.map((product) => (
        <div className="product" key={product.id}>
          <h3>{product.name}</h3>

          <p>
            Giá: {product.price.toLocaleString("vi-VN")} VNĐ
          </p>
        </div>
      ))}

      <div className="pagination">
        <button
          onClick={prev}
          disabled={currentPage === 1}
        >
          Prev
        </button>

        {Array.from(
          { length: totalPages },
          (_, index) => index + 1
        ).map((page) => (
          <button
            key={page}
            onClick={() => goToPage(page)}
            className={
              currentPage === page ? "active" : ""
            }
          >
            {page}
          </button>
        ))}

        <button
          onClick={next}
          disabled={currentPage === totalPages}
        >
          Next
        </button>
      </div>

      <p>
        Trang {currentPage} / {totalPages}
      </p>
    </div>
  );
}

export default ProductList;