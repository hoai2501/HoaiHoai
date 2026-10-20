import Accordion from "./components/Accordion/Accordion";
import ProductList from "./components/ProductList";

function App() {
  return (
    <div>
      <h1>Compound Component Accordion</h1>

      <Accordion>
        <Accordion.Item value="info">
          <Accordion.Header>
            Thông tin sản phẩm
          </Accordion.Header>

          <Accordion.Panel>
            <p>Tên sản phẩm: iPhone 15</p>
            <p>Thương hiệu: Apple</p>
          </Accordion.Panel>
        </Accordion.Item>

        <Accordion.Item value="spec">
          <Accordion.Header>
            Thông số kỹ thuật
          </Accordion.Header>

          <Accordion.Panel>
            <p>Màn hình: 6.1 inch</p>
            <p>Chip: Apple A16</p>
            <p>RAM: 6GB</p>
          </Accordion.Panel>
        </Accordion.Item>

        <Accordion.Item value="policy">
          <Accordion.Header>
            Chính sách bảo hành
          </Accordion.Header>

          <Accordion.Panel>
            <p>Bảo hành chính hãng 12 tháng.</p>
          </Accordion.Panel>
        </Accordion.Item>
      </Accordion>

      <ProductList />
    </div>
  );
}

export default App;