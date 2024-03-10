import Header from "../components/Header"
import { HomeStyle } from "../style/Home";

function Home() {
  return (
    <HomeStyle>
      <Header />
    {/* <Header />
      <ContainerCards>
        <Link to='/todayInvoices'>
          
          <CardsPages pageNames="Notas do dia">
            <ImCalendar />
          </CardsPages>
        </Link>
        <Link to='/invoices'>
          <CardsPages pageNames="Pesquisar Notas">
            <ImSearch />
          </CardsPages>
        </Link>
        <Link to='/products'>
          <CardsPages pageNames="Itens Cadastrados">
            <ImBooks />
          </CardsPages>
        </Link>
        <Link to='/routePlanning'>
          <CardsPages pageNames="Roteirização">
            <ImDisplay />
          </CardsPages>
        </Link>
        <Link to='/customers'>
          <CardsPages pageNames="Clientes">
            <ImAddressBook />
          </CardsPages>
        </Link>
        <Link to='/trips'>
          <CardsPages pageNames="Trips">
            <ImTruck />
          </CardsPages>
        </Link>
        <Link to='/uploadFiles'>
          <CardsPages pageNames="UploadFiles">
            <ImUpload2 />
          </CardsPages>
        </Link>
      </ContainerCards> */}
    </HomeStyle>
  )
}

export default Home