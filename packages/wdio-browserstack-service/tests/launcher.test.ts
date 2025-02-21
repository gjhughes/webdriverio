import path from 'node:path'
import { describe, expect, it, vi, beforeEach } from 'vitest'
// @ts-expect-error mock feature
import Browserstack, { mockStart } from 'browserstack-local'
import logger from '@wdio/logger'
import got from 'got'
import fs from 'node:fs'
import os from 'node:os'

import BrowserstackLauncher from '../src/launcher.js'
import type { BrowserstackConfig } from '../src/types.js'
import * as utils from '../src/util.js'
import { version as bstackServiceVersion } from '../package.json' assert { type: 'json' }

vi.mock('@wdio/logger', () => import(path.join(process.cwd(), '__mocks__', '@wdio/logger')))
vi.mock('browserstack-local')

const log = logger('test')
const error = new Error('I\'m an error!')
const sleep = (ms: number = 100) => new Promise((resolve) => setTimeout(resolve, ms))

beforeEach(() => {
    vi.clearAllMocks()
})

describe('onPrepare', () => {
    const options: BrowserstackConfig = { browserstackLocal: true }
    const caps: any = [{}]
    const config = {
        user: 'foobaruser',
        key: '12345',
        capabilities: []
    }
    const logInfoSpy = vi.spyOn(log, 'info').mockImplementation((string) => string)
    vi.spyOn(utils, 'launchTestSession').mockImplementation(() => {})

    it('should not try to upload app is app is undefined', () => {
        const service = new BrowserstackLauncher({ testObservability: false } as any, caps, config)
        service.onPrepare()

        expect(logInfoSpy).toHaveBeenCalledWith('app is not defined in browserstack-service config, skipping ...')
    })

    it('should not call local if browserstackLocal is undefined', () => {
        const service = new BrowserstackLauncher({ testObservability: false } as any, caps, {
            user: 'foobaruser',
            key: '12345',
            capabilities: []
        })
        service.onPrepare()

        expect(logInfoSpy).toHaveBeenNthCalledWith(2, 'browserstackLocal is not enabled - skipping...')
        expect(service.browserstackLocal).toBeUndefined()
    })

    it('should not call local if browserstackLocal is false', () => {
        const service = new BrowserstackLauncher({
            browserstackLocal: false,
            testObservability: false
        } as any, caps, {
            user: 'foobaruser',
            key: '12345',
            capabilities: []
        })
        service.onPrepare()

        expect(logInfoSpy).toHaveBeenNthCalledWith(2, 'browserstackLocal is not enabled - skipping...')
        expect(service.browserstackLocal).toBeUndefined()
    })

    it('should add the "app" property to a multiremote capability if no "bstack:options"', async () => {
        const options: BrowserstackConfig = { app: 'bs://<app-id>' }
        const service = new BrowserstackLauncher(options as any, caps, config)
        const capabilities = { samsungGalaxy: { capabilities: {} } }

        await service.onPrepare(config, capabilities)
        expect(capabilities.samsungGalaxy.capabilities).toEqual({ 'app': 'bs://<app-id>' })
    })

    it('should add the "appium:app" property to a multiremote capability if "bstack:options" present', async () => {
        const options: BrowserstackConfig = { app: 'bs://<app-id>' }
        const service = new BrowserstackLauncher(options as any, caps, config)
        const capabilities = { samsungGalaxy: { capabilities: { 'bstack:options': {} } } }

        await service.onPrepare(config, capabilities)
        expect(capabilities.samsungGalaxy.capabilities).toEqual({ 'bstack:options': {}, 'appium:app': 'bs://<app-id>' })
    })

    it('should add the "appium:app" property to a multiremote capability if any extension cap present', async () => {
        const options: BrowserstackConfig = { app: 'bs://<app-id>' }
        const service = new BrowserstackLauncher(options as any, caps, config)
        const capabilities = { samsungGalaxy: { capabilities: { 'appium:chromeOptions': {} } } }

        await service.onPrepare(config, capabilities as any)
        expect(capabilities.samsungGalaxy.capabilities).toEqual({ 'appium:app': 'bs://<app-id>', 'appium:chromeOptions': {} })
    })

    it('should add the "app" property to an array of capabilities if no "bstack:options"', async () => {
        const options: BrowserstackConfig = { app: 'bs://<app-id>' }
        const service = new BrowserstackLauncher(options as any, caps, config)
        const capabilities = [{}, {}, {}]

        await service.onPrepare(config, capabilities)
        expect(capabilities).toEqual([
            { 'app': 'bs://<app-id>' },
            { 'app': 'bs://<app-id>' },
            { 'app': 'bs://<app-id>' }
        ])
    })

    it('should add the "appium:app" property to an array of capabilities if "bstack:options" present', async () => {
        const options: BrowserstackConfig = { app: 'bs://<app-id>' }
        const service = new BrowserstackLauncher(options as any, caps, config)
        const capabilities = [{ 'bstack:options': {} }, { 'bstack:options': {} }, { 'bstack:options': {} }]

        await service.onPrepare(config, capabilities)
        expect(capabilities).toEqual([
            { 'bstack:options': {}, 'appium:app': 'bs://<app-id>' },
            { 'bstack:options': {}, 'appium:app': 'bs://<app-id>' },
            { 'bstack:options': {}, 'appium:app': 'bs://<app-id>' }
        ])
    })

    it('should add the "appium:app" property to an array of capabilities if any extension cap present', async () => {
        const options: BrowserstackConfig = { app: 'bs://<app-id>' }
        const service = new BrowserstackLauncher(options as any, caps, config)
        const capabilities = [{ 'appium:chromeOptions': {} }, { 'appium:chromeOptions': {} }]

        await service.onPrepare(config, capabilities as any)
        expect(capabilities).toEqual([
            { 'appium:app': 'bs://<app-id>', 'appium:chromeOptions': {} },
            { 'appium:app': 'bs://<app-id>', 'appium:chromeOptions': {} }
        ])
    })

    it('should add the "appium:app" as custom_id of app to capability object', async () => {
        const options: BrowserstackConfig = { app: 'custom_id' }
        const service = new BrowserstackLauncher(options as any, caps, config)
        const capabilities = [{ 'appium:chromeOptions': {} }, { 'appium:chromeOptions': {} }]

        await service.onPrepare(config, capabilities as any)
        expect(capabilities).toEqual([
            { 'appium:app': 'custom_id', 'appium:chromeOptions': {} },
            { 'appium:app': 'custom_id', 'appium:chromeOptions': {} }
        ])
    })

    it('should add the "appium:app" as shareable_id of app to capability object', async () => {
        const options: BrowserstackConfig = { app: 'user/custom_id' }
        const service = new BrowserstackLauncher(options as any, caps, config)
        const capabilities = [{ 'appium:chromeOptions': {} }, { 'appium:chromeOptions': {} }]

        await service.onPrepare(config, capabilities as any)
        expect(capabilities).toEqual([
            { 'appium:app': 'user/custom_id', 'appium:chromeOptions': {} },
            { 'appium:app': 'user/custom_id', 'appium:chromeOptions': {} }
        ])
    })

    it('should add "appium:app" property with value returned from app upload to capabilities', async () => {
        const options: BrowserstackConfig = { app: '/some/dummy/file.apk' }
        const service = new BrowserstackLauncher(options as any, caps, config)
        const capabilities = [{ 'bstack:options': {} }, { 'bstack:options': {} }, { 'bstack:options': {} }]

        vi.spyOn(fs, 'existsSync').mockReturnValueOnce(true)
        vi.spyOn(service, '_uploadApp').mockImplementation(() => Promise.resolve({ app_url: 'bs://<app-id>' }))

        await service.onPrepare(config, capabilities)
        expect(capabilities).toEqual([
            { 'bstack:options': {}, 'appium:app': 'bs://<app-id>' },
            { 'bstack:options': {}, 'appium:app': 'bs://<app-id>' },
            { 'bstack:options': {}, 'appium:app': 'bs://<app-id>' }
        ])
    })

    it('should upload app if path property present in appConfig', async() => {
        const options: BrowserstackConfig = { app: { path: '/path/to/app.apk' } }
        const service = new BrowserstackLauncher(options as any, caps, config)
        const capabilities = [{ 'bstack:options': {} }, { 'bstack:options': {} }, { 'bstack:options': {} }]

        vi.spyOn(fs, 'existsSync').mockReturnValueOnce(true)
        vi.spyOn(service, '_uploadApp').mockImplementation(() => Promise.resolve({ app_url: 'bs://<app-id>' }))

        await service.onPrepare(config, capabilities)
        expect(capabilities).toEqual([
            { 'bstack:options': {}, 'appium:app': 'bs://<app-id>' },
            { 'bstack:options': {}, 'appium:app': 'bs://<app-id>' },
            { 'bstack:options': {}, 'appium:app': 'bs://<app-id>' }
        ])
    })

    it('should upload app along with custom_id if path and custom_id property present in appConfig', async() => {
        const options: BrowserstackConfig = { app: { path: '/path/to/app.apk', custom_id: 'custom_id' } }
        const service = new BrowserstackLauncher(options as any, caps, config)
        const capabilities = [{ 'bstack:options': {} }, { 'bstack:options': {} }, { 'bstack:options': {} }]

        vi.spyOn(fs, 'existsSync').mockReturnValueOnce(true)
        vi.spyOn(service, '_uploadApp').mockImplementation(() => Promise.resolve({ app_url: 'bs://<app-id>', custom_id: 'custom_id', shareable_id: 'foobaruser/custom_id' }))

        await service.onPrepare(config, capabilities)
        expect(capabilities).toEqual([
            { 'bstack:options': {}, 'appium:app': 'bs://<app-id>' },
            { 'bstack:options': {}, 'appium:app': 'bs://<app-id>' },
            { 'bstack:options': {}, 'appium:app': 'bs://<app-id>' }
        ])
    })

    it('should throw SevereServiceError if _validateApp fails', async () => {
        const options: BrowserstackConfig = { app: 'bs://<app-id>' }
        const service = new BrowserstackLauncher(options, caps, config)
        const capabilities = { samsungGalaxy: { capabilities: {} } }

        vi.spyOn(service, '_validateApp').mockImplementationOnce(() => { throw new Error() } )

        try {
            await service.onPrepare(config, capabilities)
        } catch (e: any) {
            expect(e.name).toEqual('SevereServiceError')
        }
    })

    it('should throw SevereServiceError if fs.existsSync fails', async () => {
        const options: BrowserstackConfig = { app: { path: '/path/to/app.apk', custom_id: 'custom_id' } }
        const service = new BrowserstackLauncher(options, caps, config)
        const capabilities = { samsungGalaxy: { capabilities: {} } }

        vi.spyOn(service, '_validateApp').mockImplementation(() => Promise.resolve({ app: 'bs://<app-id>', customId: 'custom_id' }))
        vi.spyOn(fs, 'existsSync').mockReturnValue(false)

        try {
            await service.onPrepare(config, capabilities)
        } catch (e: any) {
            expect(e.name).toEqual('SevereServiceError')
            expect(e.message).toEqual('[Invalid app path] app path ${app.app} is not correct, Provide correct path to app under test')
        }
    })

    it('should initialize the opts object, and spawn a new Local instance', async () => {
        const service = new BrowserstackLauncher(options as any, caps, config)
        await service.onPrepare(config, caps)
        expect(service.browserstackLocal).toBeDefined()
    })

    it('should add the "browserstack.local" property to a multiremote capability if no "bstack:options"', async () => {
        const service = new BrowserstackLauncher(options as any, caps, config)
        const capabilities = { chromeBrowser: { capabilities: {} } }

        await service.onPrepare(config, capabilities)
        expect(capabilities.chromeBrowser.capabilities).toEqual({ 'browserstack.local': true })
    })

    it('should add the "browserstack.localIdentifier" property to a multiremote capability if no "bstack:options"', async () => {
        const service = new BrowserstackLauncher({
            browserstackLocal: true,
            opts: { localIdentifier: 'wdio1' }
        }, caps, {
            user: 'foobaruser',
            key: '12345',
            capabilities: []
        })
        const capabilities = { chromeBrowser: { capabilities: {} } }

        await service.onPrepare(config, capabilities)
        expect(capabilities.chromeBrowser.capabilities).toEqual({ 'browserstack.local': true, 'browserstack.localIdentifier': 'wdio1' })
    })

    it('should add the "local" property to a multiremote capability inside "bstack:options" if "bstack:options" present', async () => {
        const service = new BrowserstackLauncher(options as any, caps, config)
        const capabilities = { chromeBrowser: { capabilities: { 'bstack:options': {} } } }

        await service.onPrepare(config, capabilities)
        expect(capabilities.chromeBrowser.capabilities).toEqual({ 'bstack:options': { local: true } })
    })

    it('should add the "localIdentifier" property to a multiremote capability inside "bstack:options" if "bstack:options" present', async () => {
        const service = new BrowserstackLauncher({
            browserstackLocal: true,
            opts: { localIdentifier: 'wdio1' }
        }, caps, {
            user: 'foobaruser',
            key: '12345',
            capabilities: []
        })
        const capabilities = { chromeBrowser: { capabilities: { 'bstack:options': {} } } }

        await service.onPrepare(config, capabilities)
        expect(capabilities.chromeBrowser.capabilities).toEqual({ 'bstack:options': { local: true, localIdentifier: 'wdio1' } })
    })

    it('should add the "local" property to a multiremote capability inside "bstack:options" if any extension cap present', async () => {
        const service = new BrowserstackLauncher(options as any, caps, config)
        const capabilities = { chromeBrowser: { capabilities: { 'goog:chromeOptions': {} } } }

        await service.onPrepare(config, capabilities)
        expect(capabilities.chromeBrowser.capabilities).toEqual({ 'bstack:options': { local: true }, 'goog:chromeOptions': {} })
    })

    it('should add the "localIdentifier" property to a multiremote capability inside "bstack:options" if any extension cap present', async () => {
        const service = new BrowserstackLauncher({
            browserstackLocal: true,
            opts: { localIdentifier: 'wdio1' }
        }, caps, config)
        const capabilities = { chromeBrowser: { capabilities: { 'goog:chromeOptions': {} } } }

        await service.onPrepare(config, capabilities)
        expect(capabilities.chromeBrowser.capabilities).toEqual({ 'bstack:options': { local: true, localIdentifier: 'wdio1' }, 'goog:chromeOptions': {} })
    })

    it('should add the "localIdentifier" property to an array of capabilities inside "bstack:options" if "bstack:options" present', async () => {
        const service = new BrowserstackLauncher({
            browserstackLocal: true,
            opts: { localIdentifier: 'wdio1' }
        }, caps, config)
        const capabilities = [{ 'bstack:options': {} }, { 'bstack:options': {} }, { 'bstack:options': {} }]

        await service.onPrepare(config, capabilities)
        expect(capabilities).toEqual([
            { 'bstack:options': { local: true, localIdentifier: 'wdio1' } },
            { 'bstack:options': { local: true, localIdentifier: 'wdio1' } },
            { 'bstack:options': { local: true, localIdentifier: 'wdio1' } }
        ])
    })

    it('should add the "browserstack.local" property to an array of capabilities if no "bstack:options"', async () => {
        const service = new BrowserstackLauncher(options as any, caps, config)
        const capabilities = [{}, {}, {}]

        await service.onPrepare(config, capabilities)
        expect(capabilities).toEqual([
            { 'browserstack.local': true },
            { 'browserstack.local': true },
            { 'browserstack.local': true }
        ])
    })

    it('should add the "browserstack.localIdentifier" property to an array of capabilities if no "bstack:options"', async () => {
        const service = new BrowserstackLauncher({
            browserstackLocal: true,
            opts: { localIdentifier: 'wdio1' }
        }, caps, {
            user: 'foobaruser',
            key: '12345',
            capabilities: []
        })
        const capabilities = [{}, {}, {}]

        await service.onPrepare(config, capabilities)
        expect(capabilities).toEqual([
            { 'browserstack.local': true, 'browserstack.localIdentifier': 'wdio1' },
            { 'browserstack.local': true, 'browserstack.localIdentifier': 'wdio1' },
            { 'browserstack.local': true, 'browserstack.localIdentifier': 'wdio1' }
        ])
    })

    it('should add the "local" property to an array of capabilities inside "bstack:options" if "bstack:options" present', async () => {
        const service = new BrowserstackLauncher(options as any, caps, config)
        const capabilities = [{ 'bstack:options': {} }, { 'bstack:options': {} }, { 'bstack:options': {} }]

        await service.onPrepare(config, capabilities)
        expect(capabilities).toEqual([
            { 'bstack:options': { local: true } },
            { 'bstack:options': { local: true } },
            { 'bstack:options': { local: true } }
        ])
    })

    it('should add the "local" property to an array of capabilities inside "bstack:options" if any extension cap present', async () => {
        const service = new BrowserstackLauncher(options as any, caps, config)
        const capabilities = [{ 'ms:edgeOptions': {} }, { 'goog:chromeOptions': {} }, { 'moz:firefoxOptions': {} }]

        await service.onPrepare(config, capabilities)
        expect(capabilities).toEqual([
            { 'bstack:options': { local: true }, 'ms:edgeOptions': {} },
            { 'bstack:options': { local: true }, 'goog:chromeOptions': {} },
            { 'bstack:options': { local: true }, 'moz:firefoxOptions': {} }
        ])
    })

    it('should add the "buildIdentifier" property to a multiremote capability inside "bstack:options" if "bstack:options" present', async () => {
        const caps: any = { chromeBrowser: { capabilities: { 'bstack:options': { buildName: 'browserstack wdio build', buildIdentifier: '#${BUILD_NUMBER}' } } } }
        const service = new BrowserstackLauncher({} as any, caps, config)
        const capabilities = { chromeBrowser: { capabilities: { 'bstack:options': { buildName: 'browserstack wdio build', buildIdentifier: '#${BUILD_NUMBER}' } } } }
        vi.spyOn(service, '_getLocalBuildNumber').mockImplementation(() => { return '1' })

        await service.onPrepare(config, capabilities)
        expect(capabilities.chromeBrowser.capabilities).toEqual({ 'bstack:options': { buildName: 'browserstack wdio build', buildIdentifier: '#1' } })
    })

    it('should add the "buildIdentifier" property to an array of capabilities inside "bstack:options" if "bstack:options" present', async () => {
        const caps: any = [{ 'bstack:options': {
            buildName: 'browserstack wdio build',
            buildIdentifier: '#${BUILD_NUMBER}'
        } },
        { 'bstack:options': {
            buildName: 'browserstack wdio build',
            buildIdentifier: '#${BUILD_NUMBER}'
        } }]
        const service = new BrowserstackLauncher(options as any, caps, config)
        const capabilities = [{ 'bstack:options': { buildName: 'browserstack wdio build', buildIdentifier: '#${BUILD_NUMBER}' } }, { 'bstack:options': { buildName: 'browserstack wdio build', buildIdentifier: '#${BUILD_NUMBER}' } }]
        vi.spyOn(service, '_getLocalBuildNumber').mockImplementation(() => { return '1' })

        await service.onPrepare(config, capabilities)
        expect(capabilities).toEqual([
            { 'bstack:options': { buildName: 'browserstack wdio build', buildIdentifier: '#1', local: true } },
            { 'bstack:options': { buildName: 'browserstack wdio build', buildIdentifier: '#1', local: true } },
        ])
    })

    it('should delete the "buildIdentifier" property from Capabilities object', async () => {
        const caps: any = [{ 'bstack:options': {
            buildIdentifier: '#${BUILD_NUMBER}'
        } }]
        const service = new BrowserstackLauncher({} as any, caps, config)
        const capabilities = [{ 'bstack:options': { buildIdentifier: '#${BUILD_NUMBER}' } }]
        vi.spyOn(service, '_getLocalBuildNumber').mockImplementation(() => { return '1' })

        await service.onPrepare(config, capabilities as any)
        expect(capabilities[0]).toEqual({ 'bstack:options': {} })
    })

    it('should evaluate and set buildIdentifier from service options', async () => {
        const caps: any = { chromeBrowser: { capabilities: { 'bstack:options': { buildName: 'browserstack wdio build', buildIdentifier: 'test ${BUILD_NUMBER}' } } } }
        const service = new BrowserstackLauncher({ buildIdentifier: '#${BUILD_NUMBER}' }, caps, config)
        const capabilities = { chromeBrowser: { capabilities: { 'bstack:options': { buildName: 'browserstack wdio build', buildIdentifier: 'test ${BUILD_NUMBER}' } } } }
        vi.spyOn(service, '_getLocalBuildNumber').mockImplementation(() => { return '1' })

        await service.onPrepare(config, capabilities)
        expect(capabilities.chromeBrowser.capabilities).toEqual({ 'bstack:options': { buildName: 'browserstack wdio build', buildIdentifier: '#1' } })
    })

    it('should add "browserstack.buildIdentifier" property in capabilities if no "bstack:options" and buildIdentifier present in capabilities', async () => {
        const capabilities = [{ build: 'browserstack wdio build', 'browserstack.buildIdentifier': '#${BUILD_NUMBER}' }]
        const service = new BrowserstackLauncher(options, capabilities, {
            user: 'foobaruser',
            key: '12345',
            capabilities: []
        })
        vi.spyOn(service, '_getLocalBuildNumber').mockImplementation(() => { return '1' })

        await service.onPrepare(config, capabilities)
        expect(capabilities).toEqual([
            { build: 'browserstack wdio build', 'browserstack.buildIdentifier': '#1', 'browserstack.local': true, 'browserstack.wdioService': bstackServiceVersion }
        ])
    })

    it('should add the "browserstack.buildIdentifier" property in capabilities if no "bstack:options" and passing buildIdentifier in service options', async () => {
        const capabilities = [{ build: 'browserstack wdio build' }]
        const service = new BrowserstackLauncher({
            buildIdentifier: '#${BUILD_NUMBER}',
        }, capabilities, {
            user: 'foobaruser',
            key: '12345',
            capabilities: []
        })
        vi.spyOn(service, '_getLocalBuildNumber').mockImplementation(() => { return '1' })

        await service.onPrepare(config, capabilities)
        expect(capabilities).toEqual([
            { build: 'browserstack wdio build', 'browserstack.buildIdentifier': '#1', 'browserstack.wdioService': bstackServiceVersion }
        ])
    })

    it('should not add "browserstack.buildIdentifier" property in capabilities if no "bstack:options" and "build" not present', async () => {
        const capabilities = [{}]
        const service = new BrowserstackLauncher({
            buildIdentifier: '#${BUILD_NUMBER}',
        }, capabilities, {
            user: 'foobaruser',
            key: '12345',
            capabilities: []
        })
        vi.spyOn(service, '_getLocalBuildNumber').mockImplementation(() => { return '1' })

        await service.onPrepare(config, capabilities)
        expect(capabilities).toEqual([
            { 'browserstack.wdioService': bstackServiceVersion }
        ])
    })

    it('should delete "browserstack.buildIdentifier" property from capabilities if no "bstack:options" and "build" not present', async () => {
        const capabilities = [{ 'browserstack.buildIdentifier': '#${BUILD_NUMBER}' }]
        const service = new BrowserstackLauncher({
            buildIdentifier: '#${BUILD_NUMBER}',
        }, capabilities, {
            user: 'foobaruser',
            key: '12345',
            capabilities: []
        })
        vi.spyOn(service, '_getLocalBuildNumber').mockImplementation(() => { return '1' })

        await service.onPrepare(config, capabilities)
        expect(capabilities).toEqual([
            { 'browserstack.wdioService': bstackServiceVersion }
        ])
    })

    it('should reject if local.start throws an error', () => {
        const service = new BrowserstackLauncher(options as any, caps, config)
        mockStart.mockImplementationOnce((_: never, cb: Function) => cb(error))

        return expect(service.onPrepare(config, caps)).rejects.toThrow(error)
            .then(() => expect(service.browserstackLocal?.start).toHaveBeenCalled())
    })

    it('should successfully resolve if local.start is successful', async () => {
        const logInfoMock = vi.spyOn(log, 'info')
        const options: BrowserstackConfig = { browserstackLocal: true }
        const service = new BrowserstackLauncher(options as any, caps, config)

        await service.onPrepare(config, caps)
        expect(service.browserstackLocal?.start).toHaveBeenCalled()
        await sleep(100)
        expect(logInfoMock.mock.calls[1][0])
            .toContain('Browserstack Local successfully started after')
    })

    it('should correctly set up this-binding for local.start', async () => {
        const service = new BrowserstackLauncher(options as any, caps, config)
        await service.onPrepare(config, caps)
        expect(mockStart).toHaveBeenCalled()
        vi.clearAllMocks()
    })
})

describe('onComplete', () => {
    it('should do nothing if browserstack local is turned on, but not running', () => {
        const service = new BrowserstackLauncher({} as any, [{}] as any, {} as any)
        service.browserstackLocal = new Browserstack.Local()
        const BrowserstackLocalIsRunningSpy = vi.spyOn(service.browserstackLocal, 'isRunning')
        BrowserstackLocalIsRunningSpy.mockImplementationOnce(() => false)
        service.onComplete()
        expect(service.browserstackLocal.stop).not.toHaveBeenCalled()
    })

    it('should kill the process if forcedStop is true', async () => {
        const service = new BrowserstackLauncher({ forcedStop: true } as any, [{}] as any, {} as any)
        service.browserstackLocal = new Browserstack.Local()
        service.browserstackLocal.pid = 102

        const killSpy = vi.spyOn(process, 'kill').mockImplementationOnce((pid) => pid as any)
        expect(await service.onComplete()).toEqual(102)
        expect(killSpy).toHaveBeenCalled()
        expect(service.browserstackLocal.stop).not.toHaveBeenCalled()
    })

    it('should reject with an error, if local.stop throws an error', () => {
        const service = new BrowserstackLauncher({} as any, [{ browserName: '' }] as any, {} as any)
        service.browserstackLocal = new Browserstack.Local()
        const BrowserstackLocalStopSpy = vi.spyOn(service.browserstackLocal, 'stop')
        BrowserstackLocalStopSpy.mockImplementationOnce((cb) => cb(error))
        return expect(service.onComplete()).rejects.toThrow(error)
            .then(() => expect(service.browserstackLocal?.stop).toHaveBeenCalled())
    })

    it('should properly resolve if everything works', () => {
        const service = new BrowserstackLauncher({} as any, [{}] as any, {} as any)
        service.browserstackLocal = new Browserstack.Local()
        return expect(service.onComplete()).resolves.toBe(undefined)
            .then(() => expect(service.browserstackLocal?.stop).toHaveBeenCalled())
    })
})

describe('constructor', () => {
    const options: BrowserstackConfig = { }
    const config = {
        user: 'foobaruser',
        key: '12345',
        capabilities: [],
        specs: []
    }

    it('should add the "browserstack.wdioService" property to an array of capabilities if no "bstack:options"', async () => {
        const caps: any = [{}, {}]
        new BrowserstackLauncher(options as any, caps, config)

        expect(caps).toEqual([
            { 'browserstack.wdioService': bstackServiceVersion },
            { 'browserstack.wdioService': bstackServiceVersion }
        ])
    })

    it('should add the "wdioService" property to an array of capabilities inside "bstack:options" if "bstack:options" present', async () => {
        const caps: any = [{ 'bstack:options': {} }, { 'bstack:options': {} }]
        new BrowserstackLauncher(options as any, caps, config)

        expect(caps).toEqual([
            { 'bstack:options': { wdioService: bstackServiceVersion } },
            { 'bstack:options': { wdioService: bstackServiceVersion } }
        ])
    })

    it('should add the "wdioService" property to an array of capabilities inside "bstack:options" if any extension cap present', async () => {
        const caps: any = [{ 'moz:firefoxOptions': {} }, { 'goog:chromeOptions': {} }]
        new BrowserstackLauncher(options as any, caps, config)

        expect(caps).toEqual([
            { 'bstack:options': { wdioService: bstackServiceVersion }, 'moz:firefoxOptions': {} },
            { 'bstack:options': { wdioService: bstackServiceVersion }, 'goog:chromeOptions': {} }
        ])
    })

    it('should add the "wdioService" property to object of capabilities inside "bstack:options" if "bstack:options" present', async () => {
        const caps: any = { browserA: { capabilities: { 'goog:chromeOptions': {}, 'bstack:options': {} } } }
        new BrowserstackLauncher(options, caps, config)

        expect(caps).toEqual({ 'browserA': { 'capabilities': { 'bstack:options': { 'wdioService': bstackServiceVersion }, 'goog:chromeOptions': {} } } })
    })

    it('should add the "wdioService" property to object of capabilities inside "bstack:options" if any extension cap present', async () => {
        const caps: any = { browserA: { capabilities: { 'goog:chromeOptions': {} } } }
        new BrowserstackLauncher(options, caps, config)

        expect(caps).toEqual({ 'browserA': { 'capabilities': { 'bstack:options': { 'wdioService': bstackServiceVersion }, 'goog:chromeOptions': {} } } })
    })

    it('should add the "wdioService" property to object of capabilities inside "bstack:options" if any extension cap not present', async () => {
        const caps: any = { browserA: { capabilities: {} } }
        new BrowserstackLauncher(options, caps, config)

        expect(caps).toEqual({ 'browserA': { 'capabilities': { 'browserstack.wdioService': bstackServiceVersion } } })
    })

    it('update spec list if it is a rerun', async () => {
        process.env.BROWSERSTACK_RERUN = 'true'
        process.env.BROWSERSTACK_RERUN_TESTS = 'demo1.test.js,demo2.test.js'

        const caps: any = [{ 'bstack:options': {} }, { 'bstack:options': {} }]
        new BrowserstackLauncher(options, caps, config)

        expect(config.specs).toEqual(['demo1.test.js', 'demo2.test.js'])

        delete process.env.BROWSERSTACK_RERUN
        delete process.env.BROWSERSTACK_RERUN_TESTS
    })
})

describe('_updateCaps', () => {
    const options: BrowserstackConfig = { browserstackLocal: true }
    const caps: any = [{}]
    const config = {
        user: 'foobaruser',
        key: '12345',
        capabilities: []
    }

    it('should throw an error if "capabilities" is not an object/array', () => {
        const service = new BrowserstackLauncher(options as any, caps, config)
        const capabilities = 1

        expect(() => service._updateCaps(capabilities as any, 'local'))
            .toThrow(TypeError('Capabilities should be an object or Array!'))
    })

    it('should update the local cap in capabilities', () => {
        const options: BrowserstackConfig = { browserstackLocal: true }
        const service = new BrowserstackLauncher(options as any, caps, config)

        service._updateCaps(caps, 'local')
        expect(caps[0]['browserstack.local']).toEqual(true)
    })

    it('should update the localIdentifier cap in capabilities if present in opts', () => {
        const options: BrowserstackConfig = { browserstackLocal: true, opts: { localIdentifier: 'wdio1' } }
        const service = new BrowserstackLauncher(options as any, caps, config)

        service._updateCaps(caps, 'localIdentifier', 'wdio1')
        expect(caps[0]['browserstack.localIdentifier']).toContain('wdio1')
    })

    it('should update the buildIdentifier cap in capabilities', () => {
        const options: BrowserstackConfig = { browserstackLocal: true }
        const service = new BrowserstackLauncher(options as any, caps, config)

        service._updateCaps(caps, 'buildIdentifier', '#1')
        expect(caps[0]['browserstack.buildIdentifier']).toEqual('#1')
    })

    it('should update the buildIdentifier cap if bstack:options is not present in caps array', () => {
        const options: BrowserstackConfig = { browserstackLocal: true }
        const caps: any = [{ 'ms:edgeOptions': {} }]
        const service = new BrowserstackLauncher(options as any, caps, config)

        service._updateCaps(caps, 'buildIdentifier', '#1')
        expect(caps[0]['bstack:options']['buildIdentifier']).toEqual('#1')
    })

    it('should update buildidentifier in caps object if bstack:options is present', () => {
        const options: BrowserstackConfig = { browserstackLocal: true }
        const caps = { chromeBrowser: { capabilities: { 'goog:chromeOptions': {}, 'bstack:options': { buildIdentifier: '123' } } } }
        const service = new BrowserstackLauncher(options, caps, config)

        service._updateCaps(caps, 'buildIdentifier', '#1')
        expect(caps.chromeBrowser.capabilities['bstack:options']).toEqual({ 'wdioService': bstackServiceVersion, buildIdentifier: '#1' })
    })

    it('should update buildidentifier in caps object if bstack:options is not present', () => {
        const options: BrowserstackConfig = { browserstackLocal: true }
        const caps = { chromeBrowser: { capabilities: {} } }
        const service = new BrowserstackLauncher(options, caps, config)

        service._updateCaps(caps, 'buildIdentifier', '#1')
        expect(caps.chromeBrowser.capabilities).toEqual({ 'browserstack.wdioService': bstackServiceVersion, 'browserstack.buildIdentifier': '#1' })
    })

    it('should delete buildidentifier in caps array if value not passed in _updateCaps', () => {
        const options: BrowserstackConfig = { browserstackLocal: true }
        const caps = [{ 'bstack:options': { buildIdentifier: '1234' } }]
        const service = new BrowserstackLauncher(options as any, caps as any, config)

        service._updateCaps(caps as any, 'buildIdentifier')
        expect(caps[0]['bstack:options']).toEqual({ 'wdioService': bstackServiceVersion })
    })

    it('should delete buildidentifier in caps object if value not passed in _updateCaps', () => {
        const options: BrowserstackConfig = { browserstackLocal: true }
        const caps = { chromeBrowser: { capabilities: { 'bstack:options': { buildIdentifier: '123' } } } }
        const service = new BrowserstackLauncher(options as any, caps as any, config)

        service._updateCaps(caps as any, 'buildIdentifier')
        expect(caps.chromeBrowser.capabilities['bstack:options']).toEqual({ 'wdioService': bstackServiceVersion })
    })

    it('should delete buildidentifier in caps object if value not passed in _updateCaps', () => {
        const options: BrowserstackConfig = { browserstackLocal: true }
        const caps = { chromeBrowser: { capabilities: { 'browserstack.buildIdentifier': '#1' } } }
        const service = new BrowserstackLauncher(options, caps, config)

        service._updateCaps(caps, 'buildIdentifier')
        expect(caps.chromeBrowser.capabilities).toEqual({ 'browserstack.wdioService': bstackServiceVersion })
    })

    it('should delete buildidentifier in caps object if value not passed in _updateCaps', () => {
        const options: BrowserstackConfig = { browserstackLocal: true }
        const caps = [{ 'browserstack.buildIdentifier': '#1' }]
        const service = new BrowserstackLauncher(options, caps, config)

        service._updateCaps(caps, 'buildIdentifier')
        expect(caps[0]).toEqual({ 'browserstack.wdioService': bstackServiceVersion })
    })

    it('should update localIdentifier in caps object if extension cap is present', () => {
        const options: BrowserstackConfig = { browserstackLocal: true, opts: { localIdentifier: 'wdio1' }  }
        const caps: any = { chromeBrowser: { capabilities: { 'goog:chromeOptions': {} } } }
        const service = new BrowserstackLauncher(options, caps, config)

        service._updateCaps(caps, 'localIdentifier', 'wdio1')
        expect(caps.chromeBrowser.capabilities['bstack:options']).toEqual({ 'wdioService': bstackServiceVersion, localIdentifier: 'wdio1' })
    })
})

describe('_validateApp', () => {
    const caps: any = [{}]
    const config = {
        user: 'foobaruser',
        key: '12345',
        capabilities: []
    }

    it('should use id as app value', async() => {
        const options: BrowserstackConfig = { app: { id: 'bs://<app-id>' } }
        const service = new BrowserstackLauncher(options as any, caps, config)

        const app:any = await service._validateApp(options.app as any)
        expect(app).toEqual({ app: 'bs://<app-id>', custom_id: undefined })
    })

    it('should throw error if more than two property passed in appConfig', async() => {
        const options: BrowserstackConfig = { app: { custom_id: 'custom_id', id: 'bs://<app-id>' } }
        const service = new BrowserstackLauncher(options as any, caps, config)

        try {
            await service._validateApp(options.app as any)
        } catch (err) {
            const e = err as Error
            expect(e.message).toEqual(`keys ${Object.keys(options.app as any)} can't co-exist as app values, use any one property from
                            {id<string>, path<string>, custom_id<string>, shareable_id<string>}, only "path" and "custom_id" can co-exist.`)
        }
    })

    it('should throw error if property not matches path and custom_id in appConfig', async() => {
        const options: BrowserstackConfig = { app: { custom_id: 'custom_id', id: 'bs://<app-id>' } }
        const service = new BrowserstackLauncher(options as any, caps, config)

        try {
            await service._validateApp(options.app as any)
        } catch (err) {
            const e = err as Error
            expect(e.message).toEqual(`keys ${Object.keys(options.app as any)} can't co-exist as app values, use any one property from
                            {id<string>, path<string>, custom_id<string>, shareable_id<string>}, only "path" and "custom_id" can co-exist.`)
        }
    })

    it('should throw error if appConfig is invalid format', async() => {
        const options: BrowserstackConfig = { app: {} }
        const service = new BrowserstackLauncher(options, caps, config)

        try {
            await service._validateApp(options.app)
        } catch (e: any){
            expect(e.message).toEqual('[Invalid format] app should be string or an object')
        }
    })

    it('should throw error if appConfig is invalid format', async() => {
        const options: BrowserstackConfig = { app: { key1: '2' } }
        const service = new BrowserstackLauncher(options, caps, config)

        try {
            await service._validateApp(options.app)
        } catch (e: any){
            expect(e.message).toEqual(`[Invalid app property] supported properties are {id<string>, path<string>, custom_id<string>, shareable_id<string>}.
                        For more details please visit https://www.browserstack.com/docs/app-automate/appium/set-up-tests/specify-app ')`)
        }
    })
})

describe('_uploadApp', () => {
    const options: BrowserstackConfig = { app: '/path/to/app.apk' }
    const caps: any = [{}]
    const config = {
        user: 'foobaruser',
        key: '12345',
        capabilities: []
    }
    vi.mock('got')

    got.post = vi.fn().mockReturnValue({
        json: () => Promise.resolve({ app_url: 'bs://<app-id>' })
    })

    it('should upload the app and return app_url', async() => {
        const service = new BrowserstackLauncher(options as any, caps, config)
        const res = await service._uploadApp(options.app as any)
        expect(res).toEqual({ app_url: 'bs://<app-id>' })
    })

    it('throw SevereServiceError if upload fails', async() => {
        vi.mock('got', () => ({
            post: vi.fn().mockImplementation(() => new Promise(() => {}))
        }))

        got.post = vi.fn().mockReturnValue({
            json: () => Promise.reject({})
        })
        const service = new BrowserstackLauncher(options, caps, config)

        try {
            await service._uploadApp(options.app)
        } catch (e: any) {
            expect(got.post).toHaveBeenCalled()
            expect(e.name).toEqual('SevereServiceError')
        }
    })
})

describe('_handleBuildIdentifier', () => {
    const options: BrowserstackConfig = { browserstackLocal: true }
    const config = {
        user: 'foobaruser',
        key: '12345',
        capabilities: []
    }

    it('should update ${BUILD_NUMBER}', async() => {
        const caps: any = [{
            'bstack:options': {
                buildName: 'browserstack wdio build',
                buildIdentifier: '#${BUILD_NUMBER}'
            }
        }]
        const service = new BrowserstackLauncher(options as any, caps, config)

        vi.spyOn(service, '_getLocalBuildNumber').mockReturnValueOnce('1')
        vi.spyOn(service, '_updateLocalBuildCache').mockImplementation(() => {})
        service._handleBuildIdentifier(caps)
        expect(caps[0]['bstack:options']?.buildIdentifier).toEqual('#1')
    })

    it('should update ${DATE_TIME}', async() => {
        const caps: any = [{
            'bstack:options': {
                buildName: 'browserstack wdio build',
                buildIdentifier: '${DATE_TIME}'
            }
        }]
        const service = new BrowserstackLauncher(options as any, caps, config)

        vi.spyOn(service, '_getLocalBuildNumber').mockReturnValueOnce(null)
        vi.spyOn(service, '_updateLocalBuildCache').mockImplementation(() => {})
        service._handleBuildIdentifier(caps)

        expect(caps[0]['bstack:options']?.buildIdentifier).not.toEqual('${DATE_TIME}')
    })

    it('should update ${DATE_TIME} and ${BUILD_NUMBER}', async() => {
        const caps: any = [{
            'bstack:options': {
                buildName: 'browserstack wdio build',
                buildIdentifier: '#${BUILD_NUMBER} ${DATE_TIME}'
            }
        }]
        const service = new BrowserstackLauncher(options as any, caps, config)

        vi.spyOn(service, '_getLocalBuildNumber').mockReturnValueOnce('1')
        vi.spyOn(service, '_updateLocalBuildCache').mockImplementation(() => {})
        service._handleBuildIdentifier(caps)

        expect(caps[0]['bstack:options']?.buildIdentifier).not.toEqual('${DATE_TIME}')
        expect(caps[0]['bstack:options']?.buildIdentifier).toContain('#1')
    })

    it('should update ${BUILD_NUMBER} in case of CI', async() => {
        process.env.JENKINS_URL = 'https://jenkins-url'
        process.env.JENKINS_HOME = '~/.jenkins'
        process.env.BUILD_NUMBER = '121'
        const caps: any = [{
            'bstack:options': {
                buildName: 'browserstack wdio build',
                buildIdentifier: '${BUILD_NUMBER}'
            }
        }]
        const service = new BrowserstackLauncher(options as any, caps, config)

        service._handleBuildIdentifier(caps)
        expect(caps[0]['bstack:options']?.buildIdentifier).toContain('CI 121')

        delete process.env.JENKINS_URL
        delete process.env.JENKINS_HOME
        delete process.env.BUILD_NUMBER
    })

    it('should delete buildIdentifier if buildName is not present in caps', async() => {
        const caps: any = [{
            'bstack:options': {
                buildIdentifier: '#${BUILD_NUMBER}'
            }
        }]
        const updatedcaps: any = [{
            'bstack:options': {
                wdioService: bstackServiceVersion
            }
        }]
        const service = new BrowserstackLauncher(options as any, caps, config)

        service._handleBuildIdentifier(caps)
        expect(caps[0]).toMatchObject(updatedcaps[0])
    })

    it('should delete buildIdentifier if BROWSERSTACK_BUILD_NAME is defined as env var', async() => {
        process.env.BROWSERSTACK_BUILD_NAME = 'browserstack wdio build'
        const caps: any = [{
            'bstack:options': {
                buildIdentifier: '#${BUILD_NUMBER}'
            }
        }]
        const updatedcaps: any = [{
            'bstack:options': {
                wdioService: bstackServiceVersion
            }
        }]
        const service = new BrowserstackLauncher(options as any, caps, config)

        service._handleBuildIdentifier(caps)
        expect(caps[0]).toMatchObject(updatedcaps[0])
        delete process.env.BROWSERSTACK_BUILD_NAME
    })

    it('should not evaluate buildIdentifier if buildIdentifier is not present in the caps', async() => {
        const caps: any = [{}]
        const updatedcaps: any = [{ 'browserstack.wdioService': bstackServiceVersion }]
        const service = new BrowserstackLauncher(options as any, caps, config)

        service._handleBuildIdentifier(caps)
        expect(caps[0]).toMatchObject(updatedcaps[0])
    })

    it('should return if localBuildNumber is null', async() => {
        const caps: any = [{
            'bstack:options': {
                buildName: 'browserstack wdio build',
                buildIdentifier: '#${BUILD_NUMBER}'
            }
        }]
        const service = new BrowserstackLauncher(options as any, caps, config)
        vi.spyOn(service, '_getLocalBuildNumber').mockReturnValueOnce(null)

        service._handleBuildIdentifier(caps)
        expect(caps[0]['bstack:options']?.buildIdentifier).toEqual('#${BUILD_NUMBER}')
    })
})

describe('_getLocalBuildNumber', () => {
    const options: BrowserstackConfig = { browserstackLocal: true }
    const config = {
        user: 'foobaruser',
        key: '12345',
        capabilities: []
    }
    const caps: any = [{
        'bstack:options': {
            buildName: 'browserstack wdio build',
            buildIdentifier: '#${BUILD_NUMBER}'
        }
    }]
    const service = new BrowserstackLauncher(options as any, caps, config)
    vi.spyOn(fs, 'existsSync').mockReturnValue(true)

    it('returns 1 in case of buildName key not present in json file', async() => {
        vi.spyOn(fs, 'existsSync').mockReturnValue(true)
        vi.spyOn(fs, 'readFileSync').mockReset().mockReturnValue(JSON.stringify({ 'browserstack wdio build test': { 'identifier': 2 } }))
        vi.spyOn(service, '_updateLocalBuildCache').mockImplementation(() => {})
        const buildNumber = service._getLocalBuildNumber()
        expect(buildNumber).toEqual('1')
    })

    it('returns new identifier in case of buildName key is present in json file', async() => {
        vi.spyOn(fs, 'existsSync').mockReturnValue(true)
        vi.spyOn(fs, 'readFileSync').mockReset().mockReturnValue(JSON.stringify({ 'browserstack wdio build': { 'identifier': 2 } }))
        vi.spyOn(service, '_updateLocalBuildCache').mockImplementation(() => {})
        const buildNumber = service._getLocalBuildNumber()
        expect(buildNumber).toEqual('3')
    })

    it('returns null in case of caught exception', async() => {
        vi.spyOn(fs, 'existsSync').mockReturnValue(true)
        vi.spyOn(service, '_updateLocalBuildCache').mockImplementation(() => { throw new Error('Unable to parse JSON file') })
        const buildNumber = service._getLocalBuildNumber()
        expect(buildNumber).toEqual(null)
    })
})

describe('_updateLocalBuildCache', () => {
    const options: BrowserstackConfig = { browserstackLocal: true }
    const config = {
        user: 'foobaruser',
        key: '12345',
        capabilities: []
    }
    const caps: any = [{
        'bstack:options': {
            buildName: 'browserstack wdio build test',
            buildIdentifier: '#${BUILD_NUMBER}'
        }
    }]
    const service = new BrowserstackLauncher(options as any, caps, config)

    it('updates buildIdentifier in json file', async() => {
        vi.spyOn(fs, 'writeFileSync').mockImplementation(() => {})
        vi.spyOn(fs, 'readFileSync').mockReset().mockReturnValue(JSON.stringify({ 'browserstack wdio build test' : { 'identifier' : 3 } }))
        const browserstackFolderPath = path.join(os.homedir(), '.browserstack')
        const filePath = path.join(browserstackFolderPath, '.build-name-cache.json')

        service._updateLocalBuildCache(filePath, 'browserstack wdio build test', 3)
        const buildCacheFileData = fs.readFileSync(filePath)

        const parsedBuildCacheFileData = JSON.parse(buildCacheFileData.toString())
        expect(parsedBuildCacheFileData['browserstack wdio build test']['identifier']).toEqual(3)
    })

    it('updates buildIdentifier in json file', async() => {
        const writeFileSyncSpy = vi.spyOn(fs, 'writeFileSync')
        writeFileSyncSpy.mockImplementation(() => {})
        vi.spyOn(fs, 'readFileSync').mockReset().mockReturnValue(JSON.stringify({ 'browserstack wdio build test' : { 'identifier' : 3 } }))
        const browserstackFolderPath = path.join(os.homedir(), '.browserstack')
        const filePath = path.join(browserstackFolderPath, '.build-name-cache.json')

        service._updateLocalBuildCache(filePath, undefined, 3)
        expect(writeFileSyncSpy).not.toHaveBeenCalled()
    })
})
