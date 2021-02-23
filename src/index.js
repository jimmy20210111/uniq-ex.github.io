import React from 'react';
import ReactDOM from 'react-dom';
import { App } from './App';
import * as Ontology from '@ont-dev/ontology-dapi';
import { positions, Provider } from "react-alert";
import { createStore } from 'redux';
import { StoreContext } from 'redux-react-hook';
import AlertTemplate from "react-alert-template-basic";
import reducers from './reducers';
import reportWebVitals from './reportWebVitals';

import 'rc-tooltip/assets/bootstrap.css'
import './styles/font.css';
import './styles/common.css';
import './index.css';

const store = createStore(reducers)

Ontology.client.registerClient({});

const options = {
  timeout: 5000,
  position: positions.TOP_CENTER
};

ReactDOM.render(
  <Provider template={AlertTemplate} {...options}>
    <StoreContext.Provider value={store}>
      <App />
    </StoreContext.Provider>
  </Provider>,
  document.getElementById('root')
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
