import styled from "styled-components";


export const TruckLoader = styled.div`

  position: relative;
  width: 130px;
  height: 100px;
  margin-top: 100px;
  background-repeat: no-repeat;
  background-image: linear-gradient(#0277bd, #0277bd),
  linear-gradient(#29b6f6, #4fc3f7), linear-gradient(#29b6f6, #4fc3f7);
  background-size: 80px 70px, 30px 50px, 30px 30px;
  background-position: 0 0, 80px 20px, 100px 40px;

  &:after {
    content: "";
    position: absolute;
    bottom: 10px;
    left: 12px;
    width: 10px;
    height: 10px;
    background: #fff;
    border-radius: 50%;
    box-sizing: content-box;
    border: 10px solid #000;
    box-shadow: 78px 0 0 -10px #fff, 78px 0 #000;
    animation: wheelSk 0.75s ease-in infinite alternate;
  }

  &:before {
    content: "";
    position: absolute;
    right: 100%;
    top: 0px;
    height: 70px;
    width: 70px;
    background-image: linear-gradient(#fff 45px, transparent 0),
      linear-gradient(#fff 45px, transparent 0),
      linear-gradient(#fff 45px, transparent 0);
    background-repeat: no-repeat;
    background-size: 30px 4px;
    background-position: 0px 11px, 8px 35px, 0px 60px;
    animation: lineDropping 0.75s linear infinite;
  }

  @keyframes wheelSk {
    0%, 50%, 100% { transform: translatey(0) }
    30%, 90% { transform: translatey(-3px) }
  }

  @keyframes lineDropping {
    0% {
      background-position: 100px 11px, 115px 35px, 105px 60px;
      opacity: 1;
    }
    50% { background-position: 0px 11px, 20px 35px, 5px 60px }
    60% { background-position: -30px 11px, 0px 35px, -10px 60px }
    75%, 100% {
      background-position: -30px 11px, -30px 35px, -30px 60px;
      opacity: 0;
    }
  }
`;

export const Loading = styled.span`

  margin-top: 50px;
  position: relative;
  font-size: 48px;
  letter-spacing: 6px;

  &:before {
    content: "Loading";
    color: #fff;
  }
  &:after {
    content: "";
    width: 20px;
    height: 20px;
    background-color: #0277BD;
    background-image: radial-gradient(circle 2px, #fff4 100%, transparent 0),
      radial-gradient(circle 1px, #fff3 100%, transparent 0);
    background-position: 14px -4px, 12px -1px;
    border-radius: 50%;
    position: absolute;
    margin: auto;
    top: -5px;
    right: 62px;
    transform-origin: center bottom;
    animation: fillBaloon 1s ease-in-out infinite alternate;
  }

  @keyframes fillBaloon {
    0% { transform: scale(1)}
    100% { transform: scale(3)}
  }
`;

export const LoaderPrinting = styled.span`
  margin-top: 100px;
  position: relative;
  width: 120px;
  height: 55px;
  background-repeat: no-repeat;
  background-image:
  radial-gradient(circle 2.5px , #0277BD  100%, transparent 0),
  linear-gradient(#525252 90px, transparent 0),
  linear-gradient(#ececec 120px, transparent 0),
  linear-gradient(to right, #eee 10%,#333 10%,#333 90%,#eee 90%)
  ;

  background-size: 5px 5px, 90px 10px, 120px 45px , 100px 15px;
  background-position: 110px 15px,center bottom , center bottom , center 0 ;


  &:before {
    content: "";
    width: 70px;
    background-color: #fff;
    box-shadow: 0 0 10px #0003;
    position: absolute;
    left: 50%;
    transform: translatex(-50%);
    bottom: calc(100% - 10px);
    animation: printerPaper 4s ease-in infinite;
  }
  &:after {
    content: "";
    width: 70px;
    height: 80px;
    background-color: #fff;
    background-image:   linear-gradient(to bottom, #FFF 50%, #0277BD  51%),
                        linear-gradient(to bottom, #bbb 50%, #0000 51%);
    background-size: 60px 20px,  60px 10px;
    background-repeat: no-repeat, repeat-y;
    background-position: center 55px , center 0;
    position: absolute;
    left: 50%;
    transform: translatex(-50%) rotate(180deg);
    box-shadow: 0 10px #fff inset;
    top: calc(100% - 8px);
    animation: PrintedPaper 4s ease-in infinite;
  }

  @keyframes printerPaper {
    0% , 25% { height: 50px}
    75%, 100% { height: 0}
  }

  @keyframes PrintedPaper {
    0%, 30% {
      height: 0px;
      top: calc(100% - 8px);
    }

    80% {
      height: 80px;
      top: calc(100% - 8px);
      opacity: 1;
    }
    100% {
      height: 80px;
      top: calc(100% + 10px);
      opacity: 0;
    }
  }
      
`;