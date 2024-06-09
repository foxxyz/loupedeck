import jsConfig from '@appliedminds/eslint-config'
import jest from 'eslint-plugin-jest'
import globals from 'globals'

export default [
    ...jsConfig,
    jest.configs['flat/recommended'],
    {
        languageOptions: {
            globals: {
                ...globals.browser
            }
        }
    }
]