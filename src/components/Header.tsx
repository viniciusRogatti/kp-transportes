import { ContainerCards, HeaderStyle } from "../style/Header";
import CardsPages from "../components/CardsPages";
import { Link } from 'react-router-dom';
import { ImCalendar } from "react-icons/im";
import { ImAddressBook } from "react-icons/im";
import { ImSearch } from "react-icons/im";
import { ImTruck } from "react-icons/im";
import { ImUpload2 } from "react-icons/im";
import { ImBooks } from "react-icons/im";
import { ImDisplay } from "react-icons/im";

function Header() {
  return (
    <HeaderStyle>
      <h1>KP TRANSPORTES</h1>
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
        <Link to='/takePhoto'>
          <CardsPages pageNames="Trips">
            <ImTruck />
          </CardsPages>
        </Link>
        <Link to='/uploadFiles'>
          <CardsPages pageNames="UploadFiles">
            <ImUpload2 />
          </CardsPages>
        </Link>
      </ContainerCards>
    </HeaderStyle>
  )
}

export default Header;