# Citation Trees for Video Model Research

## Tree 1: VQ-VAE + Autoregressive Transformer Lineage

### Root: VQ-VAE (2017)

- **Paper**: Neural Discrete Representation Learning
- **Authors**: Aaron van den Oord, Oriol Vinyals, et al.
- **Citations**: 10,000+

### Generation 1: VideoGPT (2021, UC Berkeley)

```
VQ-VAE → VideoGPT: Video Generation using VQ-VAE and Transformers
├── Wilson Yan, Yunzhi Zhang, Pieter Abbeel, Aravind Srinivas
├── Citations: 807+
└── Influence: Foundation for latent video generation
```

### Key Citations of VideoGPT:

1. **CogVideo** (2022) - Large-scale pretraining for text-to-video via transformers
2. **Phenaki** (2022) - Variable length video generation from textual descriptions
3. **TECO** (ICML 2023) - Temporally consistent transformers built on VideoGPT approach
4. **MAGVIT** (CVPR 2023) - Masked generative video transformer extends VQ-VAE paradigm
5. **VideoGPT+** (2024) - Enhanced video understanding with image and video encoders

---

## Tree 2: Diffusion Transformer Lineage

### Root: DiT - Diffusion Transformer (2023)

```
Diffusion Models + Transformer → DiT: Scalable Diffusion Models with Transformers
├── William Peebles, Saining Xie
├── Conference: ICCV 2023
└── Citations: 2,000+
```

### Generation 1: Sora (2024, OpenAI)

```
DiT → Sora: Video Generation Models as World Simulators
├── Tim Brooks, Bill Peebles, et al.
├── Key innovations:
│   ├── Spacetime patches (like ViT for video)
│   ├── Joint training on images and videos
│   └── Variable duration, resolution, aspect ratio
└── Influence: Paradigm shift toward world simulation
```

### Generation 2: CogVideoX (2025, Tsinghua + Kuaishou)

```
DiT → CogVideoX: Large-scale text-to-video diffusion transformer
├── Zhicheng Zhang, et al.
├── ICLR 2025
└── Key innovations: 3D causal VAE, Expert Transformer architecture
```

### Generation 3: SANA-Video (2025, MIT + NVIDIA)

```
DiT → SANA-Video: Block Linear Diffusion Transformer
├── Junsong Chen, Song Han, et al.
├── Key innovations:
│   ├── Linear attention (O(N) instead of O(N²))
│   ├── Block-wise autoregressive for long videos
│   └── 16x faster than prior methods
└── Training cost: 1% of MovieGen
```

---

## Tree 3: World Model and Physical Reasoning Lineage

### Root: World Models (2018, DeepMind/Harvard)

```
World Models: Learning to Build World Models from Video
├── David Ha, Jürgen Schmidhuber
└── Key concept: Compress visual experiences into compact representations
```

### Branch 1: Video Generation for Planning

```
World Models → LARVA: Learning Action Representations with VAEs
          → Plannable Transformers
          → GameNGen: Diffusion-based game simulation
          → Genie: Generative interactive environments
```

### Branch 2: Physical Commonsense (Stanford/CMU)

```
World Models → How Far is Video Generation from World Model?
               (Physical Law Perspective)
               ├── Bingyi Kang, Yang Yue, et al.
               └── Key finding: Scaling alone insufficient for physical understanding
```

### Branch 3: Interactive Video Generation (2025)

```
Video Generation → Learning World Models for Interactive Video Generation
                    ├── Peking University, Oxford, Princeton
                    ├── Key: Action conditioning + memory mechanisms
                    └── Addresses compounding errors
```

---

## Tree 4: Efficient Video Generation Lineage

### Root: Efficient Attention Mechanisms

### Generation 1: Linear Attention (2024)

```
Standard Attention → Linear Attention
                   → FlashAttention
                   → Linear DiT (SANA)
```

### Generation 2: Tokenization Efficiency

```
Pixel Space → Latent Space (LDMs)
           → 3D VAE tokenization (MAGVIT, CogVideoX)
           → Progressive compression (SANA, LongLive)
```

### Generation 3: Hardware Efficiency

```
Full Precision → Quantization (NVFP4, INT8)
              → Pruning
              → Depth scaling
              → SANA-1.5: Training and inference-time compute scaling
```

---

## Summary of Major Citation Paths

### Path A: VQ-VAE → VideoGPT → TECO → Video Understanding

- Total citations along chain: 1,500+

### Path B: DiT → Sora → Video Generation as World Sim

- Influenced entire industry (Sora, Veo, MovieGen)
- Total citations: 5,000+

### Path C: World Models → Interactive Video Generation

- Emerging research direction for embodied AI
- Growing rapidly in 2024-2025

### Path D: Standard Attention → Linear Attention → Efficient DiT

- Practical impact: Enables consumer GPU deployment
- Key papers: SANA (ICLR 2025), SANA-Video, LongLive
