import React from 'react'
import ReactDOM from 'react-dom/client'
import { Sparker } from './Sparker'

const SERVER_URL = 'http://localhost:4096'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Sparker serverUrl={SERVER_URL} onClose={() => {}} />
  </React.StrictMode>
)
