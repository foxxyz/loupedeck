import jsConfig from '@appliedminds/eslint-config'
import globals from 'globals'

export default [
    ...jsConfig,
    {
        languageOptions: {
            globals: {
                ...globals.browser
            }
        }
    }
]