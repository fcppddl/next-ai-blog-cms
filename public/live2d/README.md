# Live2D 资源文件

## 下载步骤

### 1. Cubism 4 Core

从 Live2D 官网下载 Cubism 4 SDK for Web（需要免费注册账号）：
https://www.live2d.com/download/cubism-sdk/

下载解压后，将 `Core/live2dcubismcore.min.js` 复制到：
```
public/live2d/cubismcore/live2dcubismcore.min.js
```

### 2. 示例模型

从 Live2D 官网下载免费示例模型：
https://www.live2d.com/download/sample-data/

推荐下载 Haru 模型。下载解压后，将全部文件放入：
```
public/live2d/haru/
```

最终 Haru 目录应包含：
- `haru.model3.json` — 模型定义
- `haru.moc3` — 骨骼数据
- `textures/` — 贴图目录（含 png 文件）
- `motions/` — 动作动画（可选）
- `haru.physics3.json` — 物理模拟（可选）

### 3. 验证

确认以下文件存在：
```bash
ls public/live2d/cubismcore/live2dcubismcore.min.js
ls public/live2d/haru/haru.model3.json
```

## 注意事项

- 这些文件不会被 git 追踪（已加入 .gitignore）
- 如果没有模型文件，组件会自动降级为静态 Bot 图标
- Cubism Core 遵循 Live2D 专有许可，可免费用于商业和非商业用途
