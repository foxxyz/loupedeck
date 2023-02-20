import vue from '@vitejs/plugin-vue'

export default {
    optimizeDeps: {
        include: ['loupedeck']
    },
    build: {
        commonjsOptions: {
            include: [/loupedeck/, /node_modules/],
        },
    },
    plugins: [vue()]
}