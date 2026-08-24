# GlobeChain 数据管线占位

本目录只定义未来数据处理层的边界，本阶段不安装 Polars、DuckDB 或其他数据处理依赖，也不接入外部业务数据。

未来管线的发布方向：

```text
raw
  → staging
  → normalized
  → validated
  → published
```

各阶段应保留输入快照、转换规则、校验结果、来源、`method`、`datasetVersion` 和发布记录。原始数据不可变，发布数据只能来自经过验证和人工复核的候选批次。
