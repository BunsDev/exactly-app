import React, { FC, ReactNode } from 'react';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';
import ItemInfo, { ItemInfoProps } from './ItemInfo';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
type HeaderInfoProps = {
  title?: ReactNode;
  itemsInfo: ItemInfoProps[];
  variant?:
    | 'h2'
    | 'button'
    | 'caption'
    | 'h1'
    | 'h3'
    | 'h4'
    | 'h5'
    | 'h6'
    | 'inherit'
    | 'subtitle1'
    | 'subtitle2'
    | 'body1'
    | 'body2'
    | 'overline'
    | undefined;
  shadow?: boolean;
  transparent?: boolean;
  xs?: number;
};

const HeaderInfo: FC<HeaderInfoProps> = ({
  title,
  itemsInfo,
  variant = 'h6',
  shadow = true,
  xs,
  transparent = false,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  return (
    <Grid
      sx={{ ...(transparent && { bgcolor: 'components.bg' }) }}
      p={isMobile ? '16px' : '24px'}
      boxShadow={({ palette }) => (palette.mode === 'light' && shadow ? '0px 4px 12px rgba(175, 177, 182, 0.2)' : '')}
    >
      {title && (
        <Grid item mb="20px">
          <Typography variant={variant}>{title}</Typography>
        </Grid>
      )}
      <Grid item container spacing={isMobile ? 2 : xs ? 1 : 4}>
        {itemsInfo.map(({ label, value, underLabel, tooltipTitle }) => (
          <ItemInfo
            key={label.trim()}
            label={label}
            value={value}
            underLabel={underLabel}
            tooltipTitle={tooltipTitle}
            xs={xs}
          />
        ))}
      </Grid>
    </Grid>
  );
};

export default HeaderInfo;
