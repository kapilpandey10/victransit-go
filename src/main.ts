import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import { useAuthStore } from './stores/auth'
import { useUiStore } from './stores/ui'
import './styles/index.css'
import 'jsmind/style/jsmind.css'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)

const ui = useUiStore(pinia)
ui.init()

const auth = useAuthStore(pinia)
void auth.init()

app.mount('#app')