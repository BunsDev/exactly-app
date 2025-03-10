import React, { cloneElement, FC, ReactElement, useCallback, useMemo, useState } from 'react';

import BarChartRoundedIcon from '@mui/icons-material/BarChartRounded';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { Box, Button, Menu, MenuItem, popoverClasses, Typography, useTheme } from '@mui/material';
import Link from 'next/link';
import useRouter from 'hooks/useRouter';
import { Timeout } from 'react-number-format/types/types';
import { SimpleViewIcon, AdvancedViewIcon } from 'components/Icons';
import { useTranslation } from 'react-i18next';
import { type MarketView, useCustomTheme } from 'contexts/ThemeContext';
import { track } from 'utils/segment';

type ViewOption = {
  type: MarketView;
  title: string;
  description: string;
  icon: ReactElement;
};

const SelectMarketsView: FC = () => {
  const { t } = useTranslation();
  const { pathname: currentPathname, query } = useRouter();
  const { view, setView } = useCustomTheme();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [currTimeout, setCurrTimeout] = useState<Timeout>();
  const { palette } = useTheme();

  const openMenu = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      if (anchorEl !== event.currentTarget) {
        setAnchorEl(event.currentTarget);
      }
    },
    [anchorEl],
  );
  const closeMenu = useCallback(() => setAnchorEl(null), [setAnchorEl]);

  const onSelectType = useCallback(
    (type: MarketView) => {
      setView(type);
      closeMenu();
      clearTimeout(currTimeout);
    },
    [closeMenu, currTimeout, setView],
  );

  const handleOnHover = useCallback(() => clearTimeout(currTimeout), [currTimeout]);
  const handleCloseHover = useCallback(() => setCurrTimeout(setTimeout(closeMenu, 300)), [closeMenu, setCurrTimeout]);

  const views: ViewOption[] = useMemo(
    () => [
      {
        type: 'simple',
        title: t('Simple view'),
        description: t('Intuitive and user-friendly interface'),
        icon: <SimpleViewIcon />,
      },
      {
        type: 'advanced',
        title: t('Advanced view'),
        description: t('An in-depth look at APR values'),
        icon: <AdvancedViewIcon />,
      },
    ],
    [t],
  );

  const handleOptionClick = useCallback(
    (type: MarketView) => {
      onSelectType(type);
      track('Option Selected', {
        location: 'Navbar',
        name: 'market view',
        value: type,
        prevValue: view,
      });
    },
    [onSelectType, view],
  );

  return (
    <>
      <Link href={{ pathname: '/', query }}>
        <Button
          variant={
            !['/dashboard', '/strategies', '/bridge', '/governance', '/revoke', '/security', '/activity'].includes(
              currentPathname,
            )
              ? 'contained'
              : 'text'
          }
          onMouseOver={openMenu}
          onMouseLeave={handleCloseHover}
          sx={{
            pr: '4px',
            pl: '6px',
            minWidth: { xs: '60px', sm: '110px' },
            borderRadius: '32px',
            bgcolor: 'primary',
            '&:hover': {
              bgcolor: 'primary',
              filter: 'brightness(1.1)',
            },
          }}
          data-testid="navbar-link-markets"
        >
          <Box display="flex" alignItems="center" gap={0.5}>
            <BarChartRoundedIcon sx={{ fontSize: 14 }} />
            <Typography fontWeight={700} fontSize={14}>
              {t('Markets')}
            </Typography>
            {anchorEl ? (
              <ExpandLessIcon sx={{ fontSize: 14, my: 'auto' }} fontSize="small" />
            ) : (
              <ExpandMoreIcon sx={{ fontSize: 14, my: 'auto' }} fontSize="small" />
            )}
          </Box>
        </Button>
      </Link>
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={closeMenu}
        MenuListProps={{
          onMouseEnter: handleOnHover,
          onMouseLeave: handleCloseHover,
          style: { pointerEvents: 'auto' },
        }}
        slotProps={{
          paper: {
            sx: {
              marginTop: '8px',
              padding: '0px 8px',
              boxShadow: ({ palette: _palette }) =>
                _palette.mode === 'light' ? '0px 4px 10px rgba(97, 102, 107, 0.1)' : '',
              borderRadius: '8px',
              minWidth: '270px',
            },
          },
        }}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'left',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'left',
        }}
        sx={{
          [`&.${popoverClasses.root}`]: {
            pointerEvents: 'none',
          },
          selected: {
            backgroundColor: 'pink',
          },
        }}
      >
        {views.map(({ type, title, description, icon }) => (
          <MenuItem
            key={`mainnnet_chain_${type}`}
            value={type}
            onClick={() => handleOptionClick(type)}
            selected={view === type}
            sx={{
              bgcolor: view === type ? 'grey.100' : 'transparent',
              p: 1,
              borderRadius: '4px',
              '&:hover': {
                backgroundColor: 'figma.grey.100',
              },
              '&.Mui-selected': {
                backgroundColor: 'grey.100',
                '&:hover': {
                  backgroundColor: 'figma.grey.100',
                },
                '&.Mui-focusVisible': { backgroundColor: 'grey.100' },
              },
            }}
          >
            <Link href={{ pathname: '/', query }}>
              <Box display="flex" width="100%" gap={1.5}>
                <Box display="flex" alignItems="center" my="auto" px={1}>
                  {cloneElement(icon, {
                    sx: {
                      fontSize: '22px',
                      my: 'auto',
                      fill: view === type ? palette.blue : palette.figma.grey[700],
                    },
                  })}
                </Box>
                <Box display="flex" flexDirection="column" justifyContent="left">
                  <Typography fontSize="14px" fontWeight={700}>
                    {title}
                  </Typography>
                  <Typography fontSize="13px" fontWeight={500} color="figma.grey.600">
                    {description}
                  </Typography>
                </Box>
              </Box>
            </Link>
          </MenuItem>
        ))}
      </Menu>
    </>
  );
};

export default SelectMarketsView;
