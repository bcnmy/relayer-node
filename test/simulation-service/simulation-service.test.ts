import { ethers } from 'ethers';
import { RedisCacheService } from '../../common/cache';
import { GasPriceManager } from '../../common/gas-price';
import { EVMNetworkService } from '../../common/network';
import { entryPointMap } from '../../common/service-manager';
import { AASimulationService, SCWSimulationService } from '../../common/simulation';
import { TenderlySimulationService } from '../../common/simulation/external-simulation';
import { config } from '../../config';

const cacheService = RedisCacheService.getInstance();

describe('SCW transactions', () => {
  const chainId = 5;

  const networkService = new EVMNetworkService({
    chainId,
    rpcUrl: config.chains.provider[chainId],
    fallbackRpcUrls: config.chains.fallbackUrls[chainId] || [],
  });

  const gasPriceManager = new GasPriceManager(cacheService, networkService, {
    chainId,
    EIP1559SupportedNetworks: config.EIP1559SupportedNetworks,
  });

  const gasPriceService = gasPriceManager.setup();
  if (gasPriceService) {
    gasPriceService.schedule();
  }
  if (!gasPriceService) {
    throw new Error(`Gasprice service is not setup for chainId ${chainId}`);
  }

  const tenderlySimulationService = new TenderlySimulationService(gasPriceService, {
    tenderlyUser: config.simulationData.tenderlyData.tenderlyUser,
    tenderlyProject: config.simulationData.tenderlyData.tenderlyProject,
    tenderlyAccessKey: config.simulationData.tenderlyData.tenderlyAccessKey,
  });

  const scwSimulation = new SCWSimulationService(
    networkService,
    tenderlySimulationService,
  );

  beforeAll(async () => {
    await cacheService.connect();
  });
  it('Simualtion should pass', async () => {
    // TODO
    // Import SDK?
  });

  it('Simualtion should fail due to relayer being under paid', async () => {
    // TODO
    // Import SDK?
  });

  it('Simualtion should fail due to logic revert', async () => {
    const scwSimulationResponse = await scwSimulation.simulate({
      chainId,
      data: '0x20cf8fa40000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000028660000000000000000000000000000000000000000000000000000001bea67f2db00000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000000000000000000000000000000040a9cbc4453b0eeae12f3210117b422b890c1ed0000000000000000000000000000000000000000000000000000000000000240000000000000000000000000e31b0bcbda693bff2529f4a1d9f7e8f6d924c6ab000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000a00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000bb700000000000000000000000000000000000000000000000000000000000000064e3de17030000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000001b43757272656e742074696d653a2031363636373838303730393937000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000004154b3b1e39af0bfe36d6db14fb3d4309c3d08697252fdf763214ec63b27282551565c46a3ce3b1e94e58cfd96a2fbf656dda2f3fecf253f4212e0cf7b0ffccc952000000000000000000000000000000000000000000000000000000000000000',
      to: '0xD9F861E9c8cCf6330e13d71bbc907B95c3173a20',
      refundInfo: {
        tokenGasPrice: '119896797915',
        gasToken: '0x0000000000000000000000000000000000000000',
      },
    });

    const { isSimulationSuccessful } = scwSimulationResponse;
    expect(isSimulationSuccessful).toBe(false);
  });
});

describe('AA transactions on Goerli', () => {
  const chainId = 5;
  const entryPointAddress = '0x2babd7e23c8559dc53ba38d2976b9254d0f0d55b';
  const entryPointContracts = entryPointMap[chainId];

  let entryPointContract: ethers.Contract;
  for (let entryPointContractIndex = 0;
    entryPointContractIndex < entryPointContracts.length;
    entryPointContractIndex += 1) {
    if (entryPointContracts[entryPointContractIndex].address.toLowerCase()
     === entryPointAddress.toLowerCase()) {
      entryPointContract = entryPointContracts[entryPointContractIndex].entryPointContract;
      break;
    }
  }
  const networkService = new EVMNetworkService({
    chainId,
    rpcUrl: config.chains.provider[chainId],
    fallbackRpcUrls: config.chains.fallbackUrls[chainId] || [],
  });
  const aaSimulation = new AASimulationService(
    networkService,
  );
  it('Simualtion should pass', async () => {
    // TODO
    // Import SDK?
  });

  it('Simualtion should fail due to logic revert', async () => {
    const userOp = {
      sender: '0xD9F861E9c8cCf6330e13d71bbc907B95c3173a20',
      nonce: '0x4d',
      initCode: '0x',
      callData: '0x51eb2aa9000000000000000000000000e31b0bcbda693bff2529f4a1d9f7e8f6d924c6ab000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000a000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000030d400000000000000000000000000000000000000000000000000000000000000064e3de17030000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000001b43757272656e742074696d653a2031363636373836303736303138000000000000000000000000000000000000000000000000000000000000000000',
      callGasLimit: '0xc029',
      verificationGasLimit: '0x186a0',
      maxFeePerGas: '0x29d03252f6',
      maxPriorityFeePerGas: '0x59682f00',
      paymasterAndData: '0x50e8996670759e1faa315eeaccefe0c0a043aa51981ca62b817541128f5c35493a2256883bc478800d5a42a3c64cce644767b4f85275242ca5a73acc465f5f60d3fd0a5b97fc822800430e5d830dd3a0bbf004cc1c',
      preVerificationGas: '0x5208',
      signature: '0xbd0c2339f342170d2dbbaa3ab8b6b1773b602e30dc1a597d4abee05c3f9ca8380c90844c5ad22fb839cffb7fed4ace4b5b7dd1c8e152d32061d6a51ead625efb1c',
    };

    const aaSimulatonResponse = await aaSimulation.simulate({
      userOp,
      entryPointContract,
      chainId,
    });

    expect(aaSimulatonResponse.isSimulationSuccessful).toBe(false);
  });
});
