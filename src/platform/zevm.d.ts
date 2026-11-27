declare module "@evmts/zevm" {
  export interface NativeNodeConfig {
    readonly chain_id?: number
  }

  export class NativeNode {
    constructor(config?: NativeNodeConfig)
    rpc(request: string): string | null
    close(): void
  }

  export class LightClient {
    constructor(network: number, beaconRpcUrl: string, executionRpcUrl: string)
    syncStep(): number
    status(): number
    lastError(): string | null
    getBalance(address: string, blockNumber?: number): string
    getTransactionCount(address: string, blockNumber?: number): string
    getCode(address: string, blockNumber?: number): string
    getStorage(address: string, slot: string, blockNumber?: number): string
    close(): void
  }

  export function version(): string
  export function abiVersion(): number
  export function errorMessage(code: number): string
  export function networkName(network: number): string
}
