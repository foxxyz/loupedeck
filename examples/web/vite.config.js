import vue from '@vitejs/plugin-vue'

export default {
    build: {
        target: 'esnext'
    },
    plugins: [vue()]
}