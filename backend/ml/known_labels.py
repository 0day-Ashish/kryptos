"""
Known address labels — major exchanges, bridges, DEX routers, and notable contracts.

Used to enrich graph visualization and analysis output with human-readable tags.
"""

# Mapping of lowercase address → (label, category)
# Categories: "exchange", "bridge", "dex", "defi", "nft", "mixer", "stablecoin", "other"
KNOWN_ADDRESSES = {
    # --- Major CEXs ---
    "0x28c6c06298d514db089934071355e5743bf21d60": ("Binance 14", "exchange"),
    "0x21a31ee1afc51d94c2efccaa2092ad1028285549": ("Binance 15", "exchange"),
    "0xdfd5293d8e347dfe59e90efd55b2956a1343963d": ("Binance 16", "exchange"),
    "0x56eddb7aa87536c09ccc2793473599fd21a8b17f": ("Binance 17", "exchange"),
    "0x9696f59e4d72e237be84ffd425dcad154bf96976": ("Binance 18", "exchange"),
    "0xbe0eb53f46cd790cd13851d5eff43d12404d33e8": ("Binance 7", "exchange"),
    "0xf977814e90da44bfa03b6295a0616a897441acec": ("Binance 8", "exchange"),
    "0x3f5ce5fbfe3e9af3971dd833d26ba9b5c936f0be": ("Binance 1", "exchange"),
    "0xd551234ae421e3bcba99a0da6d736074f22192ff": ("Binance 2", "exchange"),
    "0x564286362092d8e7936f0549571a803b203aaced": ("Binance 3", "exchange"),
    "0x0681d8db095565fe8a346fa0277bffde9c0edbbf": ("Binance 4", "exchange"),
    "0xfe9e8709d3215310075d67e3ed32a380ccf451c8": ("Binance 5", "exchange"),
    "0x4e9ce36e442e55ecd9025b9a6e0d88485d628a67": ("Binance 6", "exchange"),
    "0x47ac0fb4f2d84898e4d9e7b4dab3c24507a6d503": ("Binance: Binance-Peg Tokens", "exchange"),
    "0xeb2629a2734e272bcc07bda959863f316f4bd4cf": ("Coinbase 6", "exchange"),
    "0xa9d1e08c7793af67e9d92fe308d5697fb81d3e43": ("Coinbase 10", "exchange"),
    "0x503828976d22510aad0201ac7ec88293211d23da": ("Coinbase 1", "exchange"),
    "0xddfabcdc4d8ffc6d5beaf154f18b778f892a0740": ("Coinbase 3", "exchange"),
    "0x3cd751e6b0078be393132286c442345e5dc49699": ("Coinbase 4", "exchange"),
    "0x71660c4005ba85c37ccec55d0c4493e66fe775d3": ("Coinbase 5", "exchange"),
    "0xb5d85cbf7cb3ee0d56b3bb207d5fc4b82f43f511": ("Coinbase 7", "exchange"),
    "0xd688aea8f7d450909ade10c47faa95707b0682d9": ("Coinbase 2", "exchange"),
    "0x2910543af39aba0cd09dbb2d50200b3e800a63d2": ("Kraken 13", "exchange"),
    "0xae2d4617c862309a3d75a0ffb358c7a5009c673f": ("Kraken 10", "exchange"),
    "0x267be1c1d684f78cb4f6a176c4911b741e4ffdc0": ("Kraken 4", "exchange"),
    "0xfa52274dd61e1643d2205169732f29114bc240b3": ("Kraken 7", "exchange"),
    "0x53d284357ec70ce289d6d64134dfac8e511c8a3d": ("Kraken 4", "exchange"),
    "0x2b5634c42055806a59e9107ed44d43c426e58258": ("KuCoin 1", "exchange"),
    "0x689c56aef474df92d44a1b70850f808488f9769c": ("KuCoin 2", "exchange"),
    "0xa7efae728d2936e78bda97dc267687568dd593f3": ("OKX 3", "exchange"),
    "0x6cc5f688a315f3dc28a7781717a9a798a59fda7b": ("OKX 4", "exchange"),
    "0x236f9f97e0e62388479bf9e5ba4889e46b0273c3": ("OKX 2", "exchange"),
    "0x75e89d5979e4f6fba9f97c104c2f0afb3f1dcb88": ("MEXC", "exchange"),
    "0x0d0707963952f2fba59dd06f2b425ace40b492fe": ("Gate.io 1", "exchange"),
    "0x7793cd85c11a924478d358d49b7f846492535b80": ("Gate.io 2", "exchange"),
    "0x1151314c646ce4e0efd76d1af4760ae66a9fe30f": ("Bitfinex 1", "exchange"),
    "0x876eabf441b2ee5b5b0554fd502a8e0600950cfa": ("Bitfinex 4", "exchange"),
    "0xab7c74abc0c4d48d1bdad5dcb26153fc8780f83e": ("Bitfinex MultiSig 1", "exchange"),
    "0xc098b2a3aa256d2140208c3de6543aaef5cd3a94": ("FTX Exchange", "exchange"),
    "0x2faf487a4414fe77e2327f0bf4ae2a264a776ad2": ("FTX 1", "exchange"),
    "0xdc76cd25977e0a5ae17155770273ad58648900d3": ("Bybit", "exchange"),
    "0xf89d7b9c864f589bbf53a82105107622b35eaa40": ("Bybit 2", "exchange"),
    "0x1ab4973a48dc892cd9971ece8e01dcc7688f8f23": ("Gemini 4", "exchange"),
    "0x07ee55aa48bb72dcc6e9d78256648910de513eca": ("Gemini 7", "exchange"),

    # --- Major DEX Routers ---
    "0x7a250d5630b4cf539739df2c5dacb4c659f2488d": ("Uniswap V2 Router", "dex"),
    "0xe592427a0aece92de3edee1f18e0157c05861564": ("Uniswap V3 Router", "dex"),
    "0x68b3465833fb72a70ecdf485e0e4c7bd8665fc45": ("Uniswap V3 Router 2", "dex"),
    "0x3fc91a3afd70395cd496c647d5a6cc9d4b2b7fad": ("Uniswap Universal Router", "dex"),
    "0xd9e1ce17f2641f24ae83637ab66a2cca9c378b9f": ("SushiSwap Router", "dex"),
    "0x1111111254eeb25477b68fb85ed929f73a960582": ("1inch v5 Router", "dex"),
    "0x11111112542d85b3ef69ae05771c2dccff4faa26": ("1inch v3 Router", "dex"),
    "0x1231deb6f5749ef6ce6943a275a1d3e7486f4eae": ("LI.FI Diamond", "dex"),
    "0xdef1c0ded9bec7f1a1670819833240f027b25eff": ("0x Exchange Proxy", "dex"),
    "0x881d40237659c251811cec9c364ef91dc08d300c": ("MetaMask Swap Router", "dex"),
    "0x3328f7f4a1d1c57c35df56bbf0c9dcafca309c49": ("Banana Gun Router", "dex"),
    "0x80a64c6d7f12c47b7c66c5b4e20e72bc0011e653": ("Maestro Router", "dex"),

    # --- Bridges ---
    "0x3154cf16ccdb4c6d922629664174b904d80f2c35": ("Base Bridge", "bridge"),
    "0x49048044d57e1c92a77f79988d21fa8faf74e97e": ("Base Portal", "bridge"),
    "0x3ee18b2214aff97000d974cf647e7c347e8fa585": ("Wormhole: Portal", "bridge"),
    "0x99c9fc46f92e8a1c0dec1b1747d010903e884be1": ("Optimism Gateway", "bridge"),
    "0x4dbd4fc535ac27206064b68ffcf827b0a60bab3f": ("Arbitrum Delayed Inbox", "bridge"),
    "0x8315177ab297ba92a06054ce80a67ed4dbd7ed3a": ("Arbitrum Bridge", "bridge"),
    "0x2796317b0ff8538f253012862c06787adfb8ceb6": ("Synapse Bridge", "bridge"),
    "0xa0c68c638235ee32657e8f720a23cec1bfc77c77": ("Polygon Bridge", "bridge"),
    "0x40ec5b33f54e0e8a33a975908c5ba1c14e5bbbdf": ("Polygon: ERC20 Bridge", "bridge"),
    "0xe4ef137290faec60a1058e29709fc09ac3b6f2af": ("Wormhole: Token Bridge", "bridge"),
    "0xd19d4b5d358258f05d7b411e21a1460d11b0876f": ("Hop Protocol", "bridge"),
    "0x1231deb6f5749ef6ce6943a275a1d3e7486f4eae": ("LI.FI Diamond", "bridge"),

    # --- DeFi Protocols ---
    "0x7d2768de32b0b80b7a3454c06bdac94a69ddc7a9": ("Aave V2 Lending Pool", "defi"),
    "0x87870bca3f3fd6335c3f4ce8392d69350b4fa4e2": ("Aave V3 Pool", "defi"),
    "0xc3d688b66703497daa19211eedff47f25384cdc3": ("Compound V3 cUSDCv3", "defi"),
    "0xa17581a9e3356d9a858b789d68b4d866e593ae94": ("Compound V3 cWETHv3", "defi"),
    "0xbebc44782c7db0a1a60cb6fe97d0b483032ff1c7": ("Curve: 3pool", "defi"),
    "0xdc24316b9ae028f1497c275eb9192a3ea0f67022": ("Lido: stETH Curve Pool", "defi"),
    "0xae7ab96520de3a18e5e111b5eaab095312d7fe84": ("Lido: stETH", "defi"),
    "0xba12222222228d8ba445958a75a0704d566bf2c8": ("Balancer: Vault", "defi"),
    "0x83f20f44975d03b1b09e64809b757c47f942beea": ("Spark: sDAI", "defi"),
    "0xc36442b4a4522e871399cd717abdd847ab11fe88": ("Uniswap V3: Positions NFT", "defi"),

    # --- Stablecoins ---
    "0xdac17f958d2ee523a2206206994597c13d831ec7": ("USDT (Tether)", "stablecoin"),
    "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48": ("USDC (Circle)", "stablecoin"),
    "0x6b175474e89094c44da98b954eedeac495271d0f": ("DAI (MakerDAO)", "stablecoin"),
    "0x4fabb145d64652a948d72533023f6e7a623c7c53": ("BUSD (Binance USD)", "stablecoin"),

    # --- Known Mixers / Privacy (flagged) ---
    "0xd90e2f925da726b50c4ed8d0fb90ad053324f31b": ("Tornado Cash: Router", "mixer"),
    "0x722122df12d4e14e13ac3b6895a86e84145b6967": ("Tornado Cash: Proxy", "mixer"),
    "0xdd4c48c0b24039969fc16d1cdf626eab821d3384": ("Tornado Cash: 0.1 ETH", "mixer"),
    "0xd4b88df4d29f5cedd6857912842cff3b20c8cfa3": ("Tornado Cash: 1 ETH", "mixer"),
    "0xfd8610d20aa15b7b2e3be39b396a1bc3516c7144": ("Tornado Cash: 10 ETH", "mixer"),
    "0x07687e702b410fa43f4cb4af7fa097918ffd2730": ("Tornado Cash: 100 ETH", "mixer"),
    "0x94a1b5cdb22c43faab4abeb5c74999895464ddba": ("Tornado Cash: 0.1 ETH 2", "mixer"),
    "0x12d66f87a04a9e220743712ce6d9bb1b5616b8fc": ("Tornado Cash: 0.1 ETH 3", "mixer"),

    # --- NFT Marketplaces ---
    "0x00000000006c3852cbef3e08e8df289169ede581": ("OpenSea: Seaport 1.1", "nft"),
    "0x00000000000001ad428e4906ae43d8f9852d0dd6": ("OpenSea: Seaport 1.4", "nft"),
    "0x00000000000000adc04c56bf30ac9d3c0aaf14dc": ("OpenSea: Seaport 1.5", "nft"),
    "0x74312363e45dcaba76c59ec49a7aa8a65a67eed3": ("X2Y2: Exchange", "nft"),
    "0x59728544b08ab483533076417fbbb2fd0b17ce3a": ("LooksRare: Exchange", "nft"),
    "0x00000000000006c7676171937c444f6bde3d6282": ("Blur: Marketplace", "nft"),

    # --- Notable ---
    "0xd8da6bf26964af9d7eed9e03e53415d37aa96045": ("Vitalik Buterin", "other"),
    "0x220866b1a2219f40e72f5c628b65d54268ca3a9d": ("Vitalik Buterin 2", "other"),
    "0x00000000219ab540356cbb839cbe05303d7705fa": ("ETH2 Deposit Contract", "other"),
    "0x0000000000000000000000000000000000000000": ("Null Address (Burn)", "other"),
    "0x000000000000000000000000000000000000dead": ("Dead Address (Burn)", "other"),
}


def lookup_address(address: str) -> dict | None:
    """Look up a known label for an address.
    Returns {"label": str, "category": str} or None.
    """
    entry = KNOWN_ADDRESSES.get(address.lower())
    if entry:
        return {"label": entry[0], "category": entry[1]}
    return None


def label_addresses(addresses: list[str]) -> dict:
    """Batch-label a list of addresses.
    Returns { address: {"label": …, "category": …} } for known ones.
    """
    result = {}
    for addr in addresses:
        info = lookup_address(addr)
        if info:
            result[addr.lower()] = info
    return result


def is_mixer(address: str) -> bool:
    """Quick check if address is a known mixer/privacy tool."""
    entry = KNOWN_ADDRESSES.get(address.lower())
    return entry is not None and entry[1] == "mixer"


def is_exchange(address: str) -> bool:
    """Quick check if address is a known centralized exchange."""
    entry = KNOWN_ADDRESSES.get(address.lower())
    return entry is not None and entry[1] == "exchange"
